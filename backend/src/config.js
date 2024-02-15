module.exports = {
  recorder: {
    minPort: 20000,
    maxPort: 30000,
  },
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        preferredPayloadType: 111,
        clockRate: 48000,
        channels: 2,
        parameters: {
          minptime: 10,
          useinbandfec: 1,
        }
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000
        }
      },
      {
        kind: 'video',
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
          'profile-id': 2,
          'x-google-start-bitrate': 1000
        }
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000
        }
      }
    ]
  },
  transport: {
    plainRtp: {
      listenIp: { ip: '0.0.0.0', announcedIp: '127.0.0.1' }, // TODO: Change announcedIp to your external IP or domain name
      rtcpMux: false,
      comedia: false
    },
    webRtc: {
      listenIps: [ { ip: '0.0.0.0', announcedIp: '127.0.0.1' } ], // TODO: Change announcedIp to your external IP or domain name
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      maxIncomingBitrate: 1500000
    },
  },
  worker: {
    rtcMinPort: 10000,
    rtcMaxPort: 19999
  },
};