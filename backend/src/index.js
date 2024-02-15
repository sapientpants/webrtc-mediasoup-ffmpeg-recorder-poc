// process.env.DEBUG = "mediasoup*"

const config = require('./config');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mediasoup = require('mediasoup');
const { getUnusedPort } = require('./ports');
const FFmpeg = require('./ffmpeg');
const PeerSession = require('./peerSession');

const app = express();

const server = http.createServer(app);

const state = {
  router: null,
  worker: null
};

const io = new Server(server, {
  cors: {
    origin: "http://localhost:1234",
    methods: ["GET", "POST"]
  }
});

const peerSessions = {};

io.on('connection', socket => {
  const peerSession = new PeerSession();
  peerSessions[socket.id] = peerSession;

  // 1. Send the router RTP capabilities to the client
  socket.emit('routerRtpCapabilities', state.router.rtpCapabilities);

  // 2. Create a new WebRTC transport
  socket.on('createTransport', async () => {
    const transport = await createTransport('webRtc', state.router);
    peerSession.addTransport(transport);

    transport.on('dtlsstatechange', dtlsState => {
      if (dtlsState === 'closed') {
        transport.close();
        peerSession.removeTransport(transport);
      }
    });

    socket.emit('createSendTransport', {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    });
  });

  // 3. Connect the transport
  socket.on('connectTransport', async (transportId, dtlsParameters) => {
    const transport = peerSession.findTransportById(transportId);
    await transport.connect({ dtlsParameters });
  });

  // 4. registerProducer is emitted once per producer created on the client
  socket.on('registerProducer', async (params, callback) => {
    const peerSession = peerSessions[socket.id];
    const transport = peerSession.findTransportById(params.transportId);
    const producer = await transport.produce(params);

    peerSession.addProducer(producer);
    callback(producer.id);
  });

  socket.on('startRecording', async () => {
    const peerSession = peerSessions[socket.id];
    const streamInfo = {};
    const filename = `output-${Date.now()}`;

    for (const producer of peerSession.producers) {
      streamInfo[producer.kind] = await createRtpStreamConsumer(peerSession, producer)
    }

    peerSession.process = createRecordingProcess(streamInfo, filename);

    setTimeout(async () => {
      for (const consumer of peerSession.consumers) {
        consumer.resume();
        consumer.requestKeyFrame();
      }
    }, 1000);
  });

  socket.on('stopRecording', async () => {
    const peerSession = peerSessions[socket.id];
    if (peerSession.process) {
      peerSession.process.kill();
      peerSession.process = undefined;
    }

    for (const remotePort of peerSession.remotePorts) {
      peerSession.removeRemotePort(remotePort);
    }
  });
});

async function createRtpStreamConsumer(peerSession, producer) {
  const rtpTransport = await createTransport('plainRtp', state.router);

  const remoteRtpPort = getUnusedPort(config.recorder.minPort, config.recorder.maxPort);
  peerSession.addRemotePort(remoteRtpPort);

  let remoteRtcpPort;
  if (!config.transport.plainRtp.rtcpMux) {
    remoteRtcpPort = getUnusedPort(config.recorder.minPort, config.recorder.maxPort);
    peerSession.addRemotePort(remoteRtcpPort);
  }

  await rtpTransport.connect({
    ip: '127.0.0.1',
    port: remoteRtpPort,
    rtcpPort: remoteRtcpPort
  });

  peerSession.addTransport(rtpTransport);

  const codecs = [];
  const routerCodec = state.router.rtpCapabilities.codecs.find(codec => codec.kind === producer.kind);
  codecs.push(routerCodec);
  const rtpCapabilities = {
    codecs
  };

  const consumer = await rtpTransport.consume({
    producerId: producer.id,
    rtpCapabilities,
    paused: true
  });

  peerSession.addConsumer(consumer);

  return {
    remoteRtpPort,
    remoteRtcpPort,
    rtpCapabilities,
    rtpParameters: consumer.rtpParameters
  };
}

function createRecordingProcess(streamInfo, filename) {
  const ffmpeg = new FFmpeg(streamInfo, filename);
  return ffmpeg;
}

async function createRouter() {
  const worker = await mediasoup.createWorker();
  return worker.createRouter({ mediaCodecs: config.router.mediaCodecs });
}

async function createTransport(type, router) {
  switch (type) {
    case 'webRtc':
      return await router.createWebRtcTransport(config.transport.webRtc);
    case 'plainRtp':
      return await router.createPlainTransport(config.transport.plainRtp);
  }
}

server.listen(3000, async () => {
  state.router = await createRouter();

  console.log('Listening on port 3000!');
});