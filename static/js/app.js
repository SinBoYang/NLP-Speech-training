/**
 * app.js — Main application orchestrator
 * Manages state, event wiring, and step transitions.
 */

// ─── Application state ───────────────────────────────────────

const state = {
  transcript:          '',
  selectedSpeaker:     null,
  analysisResult:      null,
  isRecording:         false,
  improvedTranscriptZh: '',
  improvedTranscriptEn: null,
  currentDraftLang:    'zh',
};

// ─── Speech recognizer ────────────────────────────────────────

const recognizer = new SpeechRecognizer({
  onTranscript(final, interim) {
    const ta = document.getElementById('transcript');
    // Show interim in brackets so user knows what's still being processed
    ta.value = final + (interim ? ` [${interim}]` : '');
    state.transcript = final;
    updateCharCount(final.length);
    updateStep1Next();
  },
  onError(err) {
    state.isRecording = false;
    UI.setRecordingState(false);
    if (err === 'browser-not-supported') {
      const note = document.getElementById('browser-note');
      if (note) note.textContent = '⚠️ 您的瀏覽器不支援語音辨識，請使用 Chrome 或 Edge，或直接貼上文字。';
      UI.showToast('請使用 Chrome 或 Edge 以啟用語音辨識', 'error');
    } else if (err !== 'no-speech') {
      UI.showToast(`語音辨識錯誤：${err}`, 'error');
    }
  },
  onEnd() {
    state.isRecording = false;
    UI.setRecordingState(false);
  },
});

// ─── Init ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  UI.initWaveform(30);
  UI.showStep(1);
  wireEvents();

  // Show browser note if STT not supported
  if (!recognizer.supported) {
    const note = document.getElementById('browser-note');
    if (note) note.textContent = '⚠️ 你的瀏覽器不支援語音辨識（需要 Chrome / Edge）。請直接貼上文字。';
  }
});

// ─── Event wiring ────────────────────────────────────────────

function wireEvents() {
  // Mic button
  document.getElementById('mic-btn')
    .addEventListener('click', toggleRecording);

  // Transcript textarea (manual input)
  document.getElementById('transcript').addEventListener('input', e => {
    state.transcript = e.target.value;
    updateCharCount(state.transcript.length);
    updateStep1Next();
  });

  // Clear transcript
  document.getElementById('clear-btn').addEventListener('click', () => {
    recognizer.reset();
    state.transcript = '';
    state.isRecording = false;
    const ta = document.getElementById('transcript');
    ta.value = '';
    updateCharCount(0);
    UI.setRecordingState(false);
    updateStep1Next();
  });

  // Audio file upload
  document.getElementById('audio-upload')
    .addEventListener('change', handleAudioUpload);

  // Step 1 → 2
  document.getElementById('step1-next').addEventListener('click', () => {
    if (state.isRecording) {
      recognizer.stop();
      state.isRecording = false;
    }
    state.transcript = document.getElementById('transcript').value.trim();
    UI.showStep(2);
  });

  // Speaker card selection
  document.querySelectorAll('.speaker-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.speaker-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.selectedSpeaker = card.dataset.speaker;
      document.getElementById('step2-next').disabled = false;
    });
  });

  // Step 2: Back
  document.getElementById('step2-back').addEventListener('click', () => UI.showStep(1));

  // Step 2: Analyze
  document.getElementById('step2-next').addEventListener('click', startAnalysis);

  // Step 3: Restart
  document.getElementById('step3-back').addEventListener('click', resetApp);

  // Step 3 → Step 4: show improved draft
  document.getElementById('step3-next').addEventListener('click', () => {
    TTS.stop();
    showImprovedDraft();
    UI.showStep(4);
  });

  // Step 4: Back to results
  document.getElementById('step4-back').addEventListener('click', () => {
    TTS.stop();
    UI.showStep(3);
  });

  // Step 4: New session
  document.getElementById('step4-restart').addEventListener('click', () => {
    TTS.stop();
    resetApp();
  });

  // Language toggle
  document.getElementById('lang-zh').addEventListener('click', () => switchDraftLang('zh'));
  document.getElementById('lang-en').addEventListener('click', () => switchDraftLang('en'));

  // TTS toggle
  document.getElementById('tts-toggle').addEventListener('click', () => {
    if (TTS.synth.speaking) { TTS.stop(); } else { TTS.speak(getDraftText(), getDraftLang()); }
  });

  // Copy draft text
  document.getElementById('draft-copy').addEventListener('click', () => {
    const text = getDraftText();
    navigator.clipboard?.writeText(text)
      .then(() => UI.showToast('已複製到剪貼板 ✓', 'success'))
      .catch(() => UI.showToast('複製失敗，請手動選取', 'error'));
  });
}

// ─── Recording ───────────────────────────────────────────────

/**
 * Toggle microphone recording on/off
 */
function toggleRecording() {
  if (state.isRecording) {
    recognizer.stop();
    state.isRecording = false;
    UI.setRecordingState(false);
  } else {
    recognizer.start();
    state.isRecording = true;
    UI.setRecordingState(true);
  }
}

// ─── Audio upload ────────────────────────────────────────────

/**
 * Handle audio file upload - convert to WAV and transcribe
 */
async function handleAudioUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const transcriptArea = document.getElementById('transcript');
  
  UI.showToast(`正在處理音頻：${file.name}...`, 'info');

  try {
    transcriptArea.value = '🔄 正在處理音頻檔案...';
    transcriptArea.disabled = true;
    
    // Convert to WAV format
    const wavFile = await convertAudioFileToWav(file);
    
    UI.showToast(`轉換完成，正在上傳...`, 'info');
    
    // Send to backend for transcription
    transcriptArea.value = '🔄 正在轉錄語音...';
    const result = await API.transcribe(wavFile);
    
    if (result.success) {
      state.transcript = result.transcript;
      transcriptArea.value = result.transcript;
      updateCharCount(result.transcript.length);
      updateStep1Next();
      UI.showToast('✓ 語音轉錄完成', 'success');
    } else {
      transcriptArea.value = '';
      state.transcript = '';
      updateCharCount(0);
      updateStep1Next();
      UI.showToast(`❌ 轉錄失敗：${result.error}`, 'error');
    }
  } catch (err) {
    transcriptArea.value = '';
    state.transcript = '';
    updateCharCount(0);
    updateStep1Next();
    UI.showToast(`❌ 處理失敗：${err.message}`, 'error');
  } finally {
    transcriptArea.disabled = false;
    e.target.value = '';
  }
}

/**
 * Convert audio file to standard WAV format
 * Decodes any supported audio format and re-encodes to 16-bit PCM WAV
 */
async function convertAudioFileToWav(file) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const bitDepth = 16;
    
    // Get channel data
    const channelData = [];
    for (let i = 0; i < numberOfChannels; i++) {
      channelData.push(audioBuffer.getChannelData(i));
    }
    
    // Interleave channels
    const interleaved = interleaveAudioChannels(channelData);
    
    // Convert to 16-bit PCM
    const pcmData = floatTo16BitPCM(interleaved);
    
    // Create WAV file
    const wavBlob = encodeWav(pcmData, numberOfChannels, sampleRate, bitDepth);
    
    return new File([wavBlob], 'recording.wav', { type: 'audio/wav' });
  } catch (error) {
    throw new Error(`無法轉換音頻格式：${error.message}`);
  }
}

/**
 * Interleave multi-channel audio data
 */
function interleaveAudioChannels(channelData) {
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
 * Convert Float32 samples to 16-bit PCM
 */
function floatTo16BitPCM(samples) {
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
 * Encode audio data to WAV format
 */
function encodeWav(pcmData, numberOfChannels, sampleRate, bitDepth) {
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  // Calculate sizes
  const dataSize = pcmData.byteLength;
  const fileSize = 36 + dataSize;

  // Create WAV header
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize, true);

  // RIFF type
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Combine header and PCM data
  return new Blob([header, new Uint8Array(pcmData)], { type: 'audio/wav' });
}

/**
 * Write string to DataView at offset
 */
function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// ─── Analysis ────────────────────────────────────────────────

async function startAnalysis() {
  UI.showStep(3);

  document.getElementById('loading-state').classList.remove('hidden');
  document.getElementById('results-content').classList.add('hidden');

  const loadingInterval = UI.animateLoadingSteps();

  try {
    let result;
    try {
      result = await API.analyze(state.transcript, state.selectedSpeaker);
    } catch (_) {
      await delay(3200);
      result = API.demoAnalysis(state.transcript, state.selectedSpeaker);
    }

    clearInterval(loadingInterval);
    state.analysisResult = result;
    
    // Render main results
    UI.renderResults(result, state.transcript);
    
    // Trigger advanced linguistic analysis
    setTimeout(() => {
      performAdvancedAnalysis();
    }, 500);

  } catch (err) {
    clearInterval(loadingInterval);
    UI.showToast('分析失敗，請稍後再試', 'error');
    UI.showStep(2);
  }
}

// ─── Improved Draft (Step 4) ────────────────────────────────

const speakerLabels = {
  trump:     '川普風格',
  mlk:       '金恩博士風格',
  speaker_3: '黃仁勳風格',
};

function showImprovedDraft() {
  const text = state.analysisResult?.improved_transcript || '';
  state.improvedTranscriptZh = text;
  state.improvedTranscriptEn = null;
  state.currentDraftLang = 'zh';
  UI.renderImprovedDraft(text, speakerLabels[state.selectedSpeaker] || '');
}

function getDraftText() {
  return state.currentDraftLang === 'en' && state.improvedTranscriptEn
    ? state.improvedTranscriptEn
    : state.improvedTranscriptZh;
}

function getDraftLang() {
  return state.currentDraftLang === 'en' ? 'en-US' : 'zh-TW';
}

function switchDraftLang(lang) {
  if (lang === state.currentDraftLang) return;
  TTS.stop();

  document.getElementById('lang-zh').classList.toggle('active', lang === 'zh');
  document.getElementById('lang-en').classList.toggle('active', lang === 'en');
  state.currentDraftLang = lang;

  const content = document.getElementById('draft-content');
  if (!content) return;

  if (lang === 'zh') {
    content.textContent = state.improvedTranscriptZh;
  } else {
    if (state.improvedTranscriptEn) {
      content.textContent = state.improvedTranscriptEn;
    } else {
      doTranslate();
    }
  }
}

async function doTranslate() {
  const loadingEl = document.getElementById('translate-loading');
  const errorEl   = document.getElementById('translate-error');
  const content   = document.getElementById('draft-content');

  loadingEl.classList.remove('hidden');
  errorEl.classList.add('hidden');
  content.textContent = '';

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: state.improvedTranscriptZh }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.improvedTranscriptEn = data.translated || '';
    content.textContent = state.improvedTranscriptEn;
    loadingEl.classList.add('hidden');
  } catch (_) {
    loadingEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
    state.currentDraftLang = 'zh';
    document.getElementById('lang-zh').classList.add('active');
    document.getElementById('lang-en').classList.remove('active');
    content.textContent = state.improvedTranscriptZh;
  }
}

// ─── TTS Controller ──────────────────────────────────────────

const TTS = {
  synth: window.speechSynthesis,

  speak(text, lang = 'zh-TW') {
    this.stop();
    if (!text) { UI.showToast('沒有文字可以朗讀', 'error'); return; }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang  = lang;
    utter.onstart = () => setTTSToggle(true);
    utter.onend   = () => setTTSToggle(false);
    utter.onerror = () => setTTSToggle(false);
    this.synth.speak(utter);
  },

  stop() {
    this.synth.cancel();
    setTTSToggle(false);
  },
};

function setTTSToggle(speaking) {
  const btn       = document.getElementById('tts-toggle');
  const indicator = document.getElementById('draft-tts-indicator');
  if (btn) {
    btn.textContent = speaking ? '⏹ 停止朗讀' : '▶ 朗讀';
    btn.className   = speaking ? 'tts-btn tts-stop' : 'tts-btn tts-play';
  }
  indicator?.classList.toggle('hidden', !speaking);
}

function updateTTSButtons() { setTTSToggle(false); }

// ─── Reset ───────────────────────────────────────────────────

function resetApp() {
  if (state.isRecording) {
    recognizer.reset();
    state.isRecording = false;
  }

  state.transcript          = '';
  state.selectedSpeaker     = null;
  state.analysisResult      = null;
  state.improvedTranscriptZh = '';
  state.improvedTranscriptEn = null;
  state.currentDraftLang    = 'zh';

  document.getElementById('transcript').value = '';
  updateCharCount(0);

  document.querySelectorAll('.speaker-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('step2-next').disabled = true;

  UI.setRecordingState(false);
  UI.showStep(1);
}

// ─── Helpers ─────────────────────────────────────────────────

function updateStep1Next() {
  const btn = document.getElementById('step1-next');
  if (btn) btn.disabled = state.transcript.trim().length < 10;
}

function updateCharCount(n) {
  const el = document.getElementById('char-count');
  if (el) el.textContent = n;
}

const delay = ms => new Promise(r => setTimeout(r, ms));

// ─── Word frequency (for word cloud) ────────────────────────

function computeWordFreq(text, topN = 28) {
  const stopWords = new Set([
    '的','了','在','是','有','和','就','不','都','也','很','到','去','會','著',
    '啊','嗯','啦','喔','呢','嗎','吧','呀','哦','哈','嘿','嘛',
    '可','把','與','及','為','以','而','對','等','之','中','後','其',
    '他','她','它','於','從','被','讓','使','得','這','那','個','些',
    '上','下','來','過','再','又','已','將','能','要','想','做',
  ]);

  // Extract CJK characters only
  const cjk = text.replace(/[^一-鿿]/g, '');
  const freq = {};

  // Count bigrams (2-char compounds)
  for (let i = 0; i < cjk.length - 1; i++) {
    const bigram = cjk[i] + cjk[i + 1];
    if (!stopWords.has(cjk[i]) && !stopWords.has(cjk[i + 1])) {
      freq[bigram] = (freq[bigram] || 0) + 1;
    }
  }

  return Object.entries(freq)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));
}
