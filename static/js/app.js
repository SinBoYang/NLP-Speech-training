/**
 * app.js — Main application orchestrator
 * Manages state, event wiring, and step transitions.
 */

// ─── Application state ───────────────────────────────────────

const state = {
  transcript:     '',
  selectedSpeaker: null,
  analysisResult: null,
  isRecording:    false,
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

  // Step 3: Copy improved transcript
  document.getElementById('copy-improved').addEventListener('click', () => {
    const text = document.getElementById('improved-transcript').textContent;
    navigator.clipboard?.writeText(text)
      .then(() => UI.showToast('已複製到剪貼板 ✓', 'success'))
      .catch(() => UI.showToast('複製失敗，請手動選取', 'error'));
  });

  // Step 3: Restart
  document.getElementById('step3-back').addEventListener('click', resetApp);

  // Step 3: View progress
  document.getElementById('step3-next').addEventListener('click', () => {
    loadAndShowProgress();
    UI.showStep(4);
  });

  // Step 4: New session
  document.getElementById('step4-restart').addEventListener('click', resetApp);
}

// ─── Recording ───────────────────────────────────────────────

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

// ─── Audio upload (placeholder for backend STT) ───────────────

function handleAudioUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  UI.showToast(`上傳中：${file.name}`, 'info');

  // Placeholder — real implementation calls a backend /api/transcribe endpoint
  setTimeout(() => {
    const placeholder = `（已上傳：${file.name}）\n\n（後端語音轉文字服務將在此提供轉錄結果）`;
    document.getElementById('transcript').value = placeholder;
    state.transcript = placeholder;
    updateCharCount(placeholder.length);
    updateStep1Next();
    UI.showToast('檔案已收到，請等待後端轉錄服務', 'success');
  }, 900);
}

// ─── Analysis ────────────────────────────────────────────────

async function startAnalysis() {
  const speakerLabels = {
    trump: '川普風格',
    mlk:   '金恩博士風格',
    xu:    '許智誠風格',
  };

  const labelEl = document.getElementById('speaker-style-label');
  if (labelEl) labelEl.textContent = speakerLabels[state.selectedSpeaker] || 'AI 改善版';

  const speakerTagEl = document.getElementById('score-speaker-tag');
  if (speakerTagEl) speakerTagEl.textContent = `📌 ${speakerLabels[state.selectedSpeaker] || ''}`;

  UI.showStep(3);

  // Reset results area
  document.getElementById('loading-state').classList.remove('hidden');
  document.getElementById('results-content').classList.add('hidden');

  const loadingInterval = UI.animateLoadingSteps();

  try {
    let result;
    try {
      result = await API.analyze(state.transcript, state.selectedSpeaker);
    } catch (_) {
      // Backend not ready — use demo data with simulated delay
      await delay(3200);
      result = API.demoAnalysis(state.transcript, state.selectedSpeaker);
    }

    clearInterval(loadingInterval);
    state.analysisResult = result;
    UI.renderResults(result, state.transcript);

    // Save session (best-effort)
    API.saveSession({
      transcript:      state.transcript,
      speaker:         state.selectedSpeaker,
      scores:          result.scores,
      overall:         result.overall,
      timestamp:       new Date().toISOString(),
    }).catch(() => {/* no-op */});

  } catch (err) {
    clearInterval(loadingInterval);
    UI.showToast('分析失敗，請稍後再試', 'error');
    UI.showStep(2);
  }
}

// ─── Progress ────────────────────────────────────────────────

async function loadAndShowProgress() {
  try {
    const data = await API.getProgress();
    // Merge in current session if backend returned empty
    if (data.total_sessions === 0 && state.analysisResult) {
      UI.renderProgress(API.demoProgress(state.analysisResult, state.selectedSpeaker));
    } else {
      UI.renderProgress(data);
    }
  } catch (_) {
    UI.renderProgress(API.demoProgress(state.analysisResult, state.selectedSpeaker));
  }
}

// ─── Reset ───────────────────────────────────────────────────

function resetApp() {
  if (state.isRecording) {
    recognizer.reset();
    state.isRecording = false;
  }

  state.transcript     = '';
  state.selectedSpeaker = null;
  state.analysisResult = null;

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
