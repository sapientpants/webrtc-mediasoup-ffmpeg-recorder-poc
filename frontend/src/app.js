// Import mediasoup-client
import * as mediasoupClient from 'mediasoup-client';
import { io } from "socket.io-client";

const socket = io('ws://localhost:3000');

let device;
let transport;

socket.on('routerRtpCapabilities', async (routerRtpCapabilities) => {
  device = new mediasoupClient.Device();
  await device.load({ routerRtpCapabilities });
  socket.emit('createTransport');
})

socket.on('createSendTransport', async (webrtcTransportOptions) => {
  transport = device.createSendTransport(webrtcTransportOptions);
  
  transport.on('connect', async ({ dtlsParameters }, callback, errback) => {
    try {
      await socket.emit('connectTransport', transport.id, dtlsParameters);
      callback();
    } catch (err) {
      errback(err);
    }
  });

  transport.on('produce', async (params, callback, errback) => {
    params.transportId = transport.id;
    try {
      await socket.emit('registerProducer', params, (producerId) => {
        callback({ producerId });
      });
    } catch (err) {
      errback(err);
    }
  });

  startRecording();
});

async function startRecording() {
  const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  const video = document.getElementById('localVideo');
  video.srcObject = mediaStream;

  const videoTrack = mediaStream.getVideoTracks()[0];
  const audioTrack = mediaStream.getAudioTracks()[0];

  if (videoTrack) {
    await transport.produce({ track: videoTrack });
  }

  if (audioTrack) {
    await transport.produce({ track: audioTrack });
  }

  socket.emit('startRecording');
  setTimeout(async () => {
    socket.emit('stopRecording');
  }, 5000);
}
