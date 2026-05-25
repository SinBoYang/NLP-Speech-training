/**
 * speech.js — Web Speech API wrapper
 * Handles real-time speech-to-text with auto-restart on silence.
 */

class SpeechRecognizer {
  constructor({ onTranscript, onError, onStart, onEnd } = {}) {
    this.onTranscript = onTranscript || (() => {});
    this.onError     = onError     || (() => {});
    this.onStart     = onStart     || (() => {});
    this.onEnd       = onEnd       || (() => {});

    this._recognition = null;
    this._isRecording = false;
    this._final = '';

    this.supported = this._init();
  }

  _init() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;

    const r = new SR();
    r.continuous      = true;
    r.interimResults  = true;
    r.lang            = 'zh-TW';
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          this._final += chunk;
        } else {
          interim += chunk;
        }
      }
      this.onTranscript(this._final, interim);
    };

    r.onerror = (e) => {
      if (e.error === 'no-speech') return; // non-fatal, will auto-restart
      this.onError(e.error);
    };

    r.onend = () => {
      if (this._isRecording) {
        // Silently restart to maintain continuous capture
        try { r.start(); } catch (_) { /* already started */ }
      } else {
        this.onEnd();
      }
    };

    this._recognition = r;
    return true;
  }

  start() {
    if (!this.supported) {
      this.onError('browser-not-supported');
      return;
    }
    this._final = '';
    this._isRecording = true;
    try {
      this._recognition.start();
      this.onStart();
    } catch (err) {
      this.onError(err.message);
    }
  }

  stop() {
    this._isRecording = false;
    try { this._recognition?.stop(); } catch (_) { /* ignore */ }
  }

  reset() {
    this.stop();
    this._final = '';
  }

  get isRecording() { return this._isRecording; }
  get transcript()  { return this._final; }
}
