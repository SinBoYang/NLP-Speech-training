/**
 * ui.js — DOM rendering and visual state helpers
 */

const UI = {
  currentStep: 1,
  _barInterval: null,

  // ─── Step navigation ───────────────────────────────────────

  showStep(n) {
    document.querySelectorAll('.step-panel').forEach(p => {
      p.classList.add('hidden');
      p.classList.remove('animate-in');
    });

    const panel = document.getElementById(`step-${n}`);
    if (panel) {
      panel.classList.remove('hidden');
      requestAnimationFrame(() => panel.classList.add('animate-in'));
    }

    document.querySelectorAll('.step').forEach((s, i) => {
      const num = i + 1;
      s.classList.toggle('active', num === n);
      s.classList.toggle('done', num < n);
    });

    document.querySelectorAll('.step-line').forEach((line, i) => {
      line.classList.toggle('done', i < n - 1);
    });

    this.currentStep = n;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // ─── Waveform ──────────────────────────────────────────────

  initWaveform(barCount = 30) {
    const wf = document.getElementById('waveform');
    if (!wf) return;
    wf.innerHTML = '';
    for (let i = 0; i < barCount; i++) {
      const bar = document.createElement('div');
      bar.className = 'wave-bar';
      bar.style.height = '4px';
      wf.appendChild(bar);
    }
  },

  setWaveformActive(active) {
    const wf = document.getElementById('waveform');
    if (!wf) return;
    if (active) {
      wf.classList.add('active');
      this._startBars();
    } else {
      wf.classList.remove('active');
      this._stopBars();
    }
  },

  _startBars() {
    clearInterval(this._barInterval);
    const bars = document.querySelectorAll('.wave-bar');
    this._barInterval = setInterval(() => {
      bars.forEach(b => {
        b.style.height = (Math.random() * 38 + 4) + 'px';
      });
    }, 85);
  },

  _stopBars() {
    clearInterval(this._barInterval);
    document.querySelectorAll('.wave-bar').forEach(b => {
      b.style.height = '4px';
    });
  },

  // ─── Recording state ────────────────────────────────────────

  setRecordingState(recording) {
    const btn    = document.getElementById('mic-btn');
    const status = document.getElementById('record-status');
    if (!btn || !status) return;

    if (recording) {
      btn.classList.add('recording');
      btn.querySelector('.mic-icon').textContent = '⏹️';
      status.innerHTML = '<span class="record-dot"></span>錄音中… 點擊停止';
      status.style.color = 'var(--amber)';
    } else {
      btn.classList.remove('recording');
      btn.querySelector('.mic-icon').textContent = '🎤';
      status.textContent = '點擊開始錄音';
      status.style.color = '';
    }

    this.setWaveformActive(recording);
  },

  // ─── Analysis loading steps ─────────────────────────────────

  animateLoadingSteps() {
    const steps = ['ls-translate', 'ls-sentiment', 'ls-llm', 'ls-score'];
    steps.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.remove('active', 'done'); }
    });

    let i = 0;
    const interval = setInterval(() => {
      if (i > 0) {
        const prev = document.getElementById(steps[i - 1]);
        if (prev) { prev.classList.remove('active'); prev.classList.add('done'); }
      }
      if (i < steps.length) {
        const cur = document.getElementById(steps[i]);
        if (cur) cur.classList.add('active');
        i++;
      } else {
        clearInterval(interval);
      }
    }, 700);

    return interval;
  },

  // ─── Results rendering ──────────────────────────────────────

  renderResults(data, originalTranscript) {
    document.getElementById('loading-state').classList.add('hidden');
    const content = document.getElementById('results-content');
    content.classList.remove('hidden');
    content.classList.add('animate-in');

    // Coach banner
    const speakerMeta = {
      trump:     { label: '川普風格',   avatar: '🦅', title: '川普教練的分析報告' },
      mlk:       { label: '金恩博士風格', avatar: '✊', title: '金恩博士教練的分析報告' },
      speaker_3: { label: '黃仁勳風格', avatar: '⚡', title: '黃仁勳教練的分析報告' },
    };
    const meta = speakerMeta[data.speaker] || { label: 'AI 風格', avatar: '🎓', title: 'AI 教練的分析報告' };

    const avatarEl = document.getElementById('coach-avatar');
    const titleEl  = document.getElementById('coach-title');
    const summaryEl = document.getElementById('coach-summary');
    const tagEl    = document.getElementById('coach-style-tag');
    if (avatarEl)  avatarEl.textContent  = meta.avatar;
    if (titleEl)   titleEl.textContent   = meta.title;
    if (summaryEl) summaryEl.textContent = data.summary || '';
    if (tagEl)     tagEl.textContent     = `📌 ${meta.label}`;

    // Word cloud from original transcript
    this._renderWordCloud(computeWordFreq(originalTranscript));

    // Vocab suggestions
    const vocabEl = document.getElementById('vocab-list');
    if (vocabEl) {
      vocabEl.innerHTML = '';
      (data.vocab_suggestions || []).forEach(v => vocabEl.appendChild(this._makeVocabRow(v)));
    }

    // Style-based suggestions
    const speakerNameEl = document.getElementById('suggestions-speaker-name');
    const speakerDescEl = document.getElementById('suggestions-speaker-desc');
    const descMap = {
      trump:     '以下是模仿川普演說風格的針對性指導',
      mlk:       '以下是模仿金恩博士演說風格的針對性指導',
      speaker_3: '以下是模仿黃仁勳演說風格的針對性指導',
    };
    if (speakerNameEl) speakerNameEl.textContent = { trump: '川普', mlk: '金恩博士', speaker_3: '黃仁勳' }[data.speaker] || 'AI';
    if (speakerDescEl) speakerDescEl.textContent = descMap[data.speaker] || '';

    const grid = document.getElementById('suggestions-grid');
    if (grid) {
      grid.innerHTML = '';
      grid.classList.add('stagger-children');
      (data.suggestions || []).forEach(s => grid.appendChild(this._makeSuggestionCard(s)));
    }
  },

  _renderWordCloud(words) {
    const cloud = document.getElementById('word-cloud');
    if (!cloud) return;
    cloud.innerHTML = '';

    if (!words.length) {
      cloud.innerHTML = '<span class="wc-empty">文字太短，無法產生詞彙地圖</span>';
      return;
    }

    const maxCount = words[0].count;
    words.forEach(({ word, count }) => {
      const ratio = count / maxCount;
      const tier  = ratio > 0.8 ? 5 : ratio > 0.6 ? 4 : ratio > 0.4 ? 3 : ratio > 0.2 ? 2 : 1;
      const span  = document.createElement('span');
      span.className = `wc-word wc-${tier}`;
      span.textContent = word;
      span.title = `出現 ${count} 次`;
      cloud.appendChild(span);
    });
  },

  _makeVocabRow(v) {
    const row = document.createElement('div');
    row.className = 'vocab-row';
    const chips = (v.alternatives || [])
      .map(a => `<span class="vocab-chip">${a}</span>`)
      .join('');
    row.innerHTML = `
      <span class="vocab-original">${v.original}</span>
      <span class="vocab-arrow">→</span>
      <div class="vocab-chips">${chips}</div>
      ${v.reason ? `<span class="vocab-reason">💬 ${v.reason}</span>` : ''}
    `;
    return row;
  },

  _makeSuggestionCard(s) {
    const card = document.createElement('div');
    card.className = 'suggestion-card';
    card.innerHTML = `
      <div class="suggestion-icon">${s.icon}</div>
      <div class="suggestion-cat">${s.category}</div>
      <div class="suggestion-text">${s.text}</div>
    `;
    return card;
  },

  // ─── Improved Draft rendering (Step 4) ─────────────────────

  renderImprovedDraft(text, speakerLabel) {
    const content = document.getElementById('draft-content');
    if (content) {
      content.textContent = text || '';
    }
    const subtitle = document.getElementById('draft-style-subtitle');
    if (subtitle && speakerLabel) {
      subtitle.textContent = `以「${speakerLabel}」風格重新編寫`;
    }
    // Reset language toggle to Chinese
    document.getElementById('lang-zh')?.classList.add('active');
    document.getElementById('lang-en')?.classList.remove('active');
    document.getElementById('translate-error')?.classList.add('hidden');
    document.getElementById('translate-loading')?.classList.add('hidden');
    // Reset TTS toggle to idle
    updateTTSButtons();
  },

  // ─── Toast notifications ────────────────────────────────────

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('show'));
    });
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 350);
    }, 3200);
  },
};
