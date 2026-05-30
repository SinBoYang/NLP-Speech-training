/**
 * audio-processor.js — Audio recording and WAV encoding
 * Handles recording audio from microphone and converting to WAV format
 */

class AudioProcessor {
  constructor() {
    this.mediaRecorder = null;
    this.audioContext = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.stream = null;
  }

  /**
   * Initialize audio context and request microphone access
   */
  async initialize() {
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      
      console.log('AudioProcessor initialized successfully');
      console.log(`Sample rate: ${this.audioContext.sampleRate}Hz`);
      
      return true;
    } catch (error) {
      console.error('Failed to initialize AudioProcessor:', error);
      return false;
    }
  }

  /**
   * Start recording audio
   */
  async startRecording() {
    if (!this.stream) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Unable to access microphone');
      }
    }

    this.audioChunks = [];
    this.isRecording = true;

    // Create MediaRecorder with appropriate MIME type
    const mimeType = AudioProcessor.getSupportedMimeType();
    console.log(`Using MIME type: ${mimeType}`);

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: mimeType,
      audioBitsPerSecond: 128000,
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start();
    console.log('Recording started');
  }

  /**
   * Stop recording and convert to WAV
   */
  async stopRecording() {
    if (!this.mediaRecorder) {
      throw new Error('Recording not started');
    }

    return new Promise((resolve) => {
      this.mediaRecorder.onstop = async () => {
        this.isRecording = false;
        console.log(`Recording stopped, ${this.audioChunks.length} chunks collected`);

        try {
          // Get the blob from recorded chunks
          const mimeType = AudioProcessor.getSupportedMimeType();
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          
          console.log(`Audio blob created: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

          // Convert to WAV if needed
          if (audioBlob.type.includes('wav')) {
            // Already WAV format
            console.log('Audio is already in WAV format');
            resolve(audioBlob);
          } else {
            // Convert to WAV using Web Audio API
            console.log('Converting audio to WAV format...');
            const wavBlob = await this._convertToWav(audioBlob);
            console.log(`WAV conversion complete: ${wavBlob.size} bytes`);
            resolve(wavBlob);
          }
        } catch (error) {
          console.error('Error processing recording:', error);
          reject(error);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Convert blob to WAV format using Web Audio API
   */
  async _convertToWav(audioBlob) {
    try {
      // Decode the audio data
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Get audio data
      const numberOfChannels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;
      const format = 1; // PCM
      const bitDepth = 16;

      console.log(
        `Audio buffer: ${numberOfChannels}ch, ${sampleRate}Hz, ${bitDepth}bit, ` +
        `duration: ${audioBuffer.duration.toFixed(2)}s`
      );

      // Interleave channels
      const channelData = [];
      for (let i = 0; i < numberOfChannels; i++) {
        channelData.push(audioBuffer.getChannelData(i));
      }

      const interleaved = this._interleaveChannels(channelData);

      // Create WAV file
      const wavBlob = this._encodeWav(
        interleaved,
        numberOfChannels,
        sampleRate,
        bitDepth
      );

      return wavBlob;
    } catch (error) {
      console.error('Error converting to WAV:', error);
      throw error;
    }
  }

  /**
   * Interleave multi-channel audio data
   */
  _interleaveChannels(channelData) {
    const channelCount = channelData.length;
    const sampleCount = channelData[0].length;
    const interleaved = new Float32Array(sampleCount * channelCount);

    for (let i = 0; i < sampleCount; i++) {
      for (let j = 0; j < channelCount; j++) {
        interleaved[i * channelCount + j] = channelData[j][i];
      }
    }

    return interleaved;
  }

  /**
   * Encode audio data to WAV format
   */
  _encodeWav(samples, numberOfChannels, sampleRate, bitDepth) {
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;

    // PCM data
    const pcmData = this._floatTo16BitPCM(samples);

    // Calculate sizes
    const dataSize = pcmData.length * 2; // bytes per sample = 2 for 16-bit
    const fileSize = 36 + dataSize;

    // Create WAV header
    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    // RIFF identifier
    this._writeString(view, 0, 'RIFF');
    view.setUint32(4, fileSize, true);

    // RIFF type
    this._writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this._writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data sub-chunk
    this._writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Combine header and PCM data
    return new Blob([header, pcmData], { type: 'audio/wav' });
  }

  /**
   * Convert Float32 samples to 16-bit PCM
   */
  _floatTo16BitPCM(samples) {
    const pcm = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      // Clamp to [-1, 1]
      let value = Math.max(-1, Math.min(1, samples[i]));
      // Convert to 16-bit integer
      pcm[i] = value < 0 ? value * 0x8000 : value * 0x7fff;
    }
    return pcm.buffer;
  }

  /**
   * Write string to DataView at offset
   */
  _writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Get supported MIME type for MediaRecorder
   */
  static getSupportedMimeType() {
    const types = [
      'audio/wav',
      'audio/webm',
      'audio/ogg',
      'audio/mp4',
      'audio/mpeg',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return ''; // Use default
  }

  /**
   * Stop microphone stream and clean up
   */
  cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.mediaRecorder) {
      this.mediaRecorder = null;
    }
    this.audioChunks = [];
  }
}
