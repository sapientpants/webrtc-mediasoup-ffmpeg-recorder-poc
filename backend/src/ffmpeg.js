const { Readable } = require('stream');
const child_process = require('child_process');
const { EventEmitter } = require('events');

const RECORDING_PATH = './files';
const DEBUG = process.env.DEBUG;

module.exports = class FFmpeg {
  constructor (rtpParameters, filename) {
    this.baseFilename = filename;
    this.rtpParameters = rtpParameters;
    this.ffmpegProcess = undefined;
    this.observer = new EventEmitter();
    this.spawnFFmpeg();
  }

  spawnFFmpeg () {
    this.ffmpegProcess = child_process.spawn('ffmpeg', this.ffmpegArgs);

    if (this.ffmpegProcess.stderr) {
      this.ffmpegProcess.stderr.setEncoding('utf-8');

      this.ffmpegProcess.stderr.on('data', data => {
        if (DEBUG) console.log('ffmpeg data: %o', data)
      });
    }

    if (this.ffmpegProcess.stdout) {
      this.ffmpegProcess.stdout.setEncoding('utf-8');

      this.ffmpegProcess.stdout.on('data', data => {
        if (DEBUG) console.log('ffmpeg data: %o', data)
      });
    }

    this.ffmpegProcess.on('message', message => {
      if (DEBUG) console.log('ffmpeg message %o', message)
    });

    this.ffmpegProcess.on('error', error => {
      if (DEBUG) console.error('ffmpeg error %o', error)
    });

    this.ffmpegProcess.once('close', () => {
      if (DEBUG) console.log('ffmpeg close');
      this.observer.emit('process-close');
    });

    const sdpString = sdpTextForRtpParameters(this.rtpParameters);
    const sdpStream = stringToReadable(sdpString);

    if (DEBUG) console.log('spawnFFmpeg() sdpString: %s', sdpString);

    sdpStream.on('error', error => {
      if (DEBUG) console.error('sdpStream error %o', error)
    });

    // Pipe sdp stream to the ffmpeg
    sdpStream.resume();
    sdpStream.pipe(this.ffmpegProcess.stdin);
  }

  kill () {
    if (DEBUG) console.log('kill() %d', this.ffmpegProcess.pid);
    this.ffmpegProcess.stdin.end();
    this.ffmpegProcess.kill('SIGINT');
  }

  get ffmpegArgs () {
    let args = [
      '-loglevel',
      'debug',
      '-protocol_whitelist',
      'pipe,udp,rtp',
      '-fflags',
      '+genpts',
      '-f',
      'sdp',
      '-i',
      'pipe:0',
      '-map', // video
      '0:v:0',
      '-c:v',
      'copy',
      '-map', // audio
      '0:a:0',
      '-strict',
      '-2',
      '-c:a',
      'copy'
    ];
    args = args.concat([
      `${RECORDING_PATH}/${this.baseFilename}.webm`
    ]);

    if (DEBUG) console.log('ffmpeg args %o', args);

    return args;
  }
}

const sdpTextForRtpParameters = (rtpParameters) => {
  const { video, audio } = rtpParameters;
  
  let videoSdpText = '';
  if (video) {
    const videoCodecInfo = getCodecInfoFromRtpParameters('video', video.rtpParameters);
    videoSdpText = `m=video ${video.remoteRtpPort} RTP/AVP ${videoCodecInfo.payloadType}
    a=rtpmap:${videoCodecInfo.payloadType} ${videoCodecInfo.codecName}/${videoCodecInfo.clockRate}
    a=sendonly`;
  }

  let audioSdpText = '';
  if (audio) {
    const audioCodecInfo = getCodecInfoFromRtpParameters('audio', audio.rtpParameters);
    audioSdpText = `m=audio ${audio.remoteRtpPort} RTP/AVP ${audioCodecInfo.payloadType}
    a=rtpmap:${audioCodecInfo.payloadType} ${audioCodecInfo.codecName}/${audioCodecInfo.clockRate}/${audioCodecInfo.channels}
    a=sendonly`;
  }

  return `v=0
  o=- 0 0 IN IP4 127.0.0.1
  s=FFmpeg
  c=IN IP4 127.0.0.1
  t=0 0
  ${videoSdpText}
  ${audioSdpText}
  `;
};

const stringToReadable = (string) => {
  const readable = new Readable();
  readable._read = () => {};
  readable.push(string);
  readable.push(null);

  return readable;
};

const getCodecInfoFromRtpParameters = (kind, rtpParameters) => {
  return getCodecInfo(kind, rtpParameters.codecs[0]);
};

const getCodecInfo = (kind, codec) => {
  return {
    payloadType: codec.payloadType,
    codecName: codec.mimeType.replace(`${kind}/`, ''),
    clockRate: codec.clockRate,
    channels: kind === 'audio' ? codec.channels : undefined
  };
}

