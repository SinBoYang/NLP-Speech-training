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

    // Original
    document.getElementById('original-transcript').textContent = originalTranscript;

    // Improved
    document.getElementById('improved-transcript').textContent = data.improved_transcript;

    // Overall score
    const vals = Object.values(data.scores);
    const overall = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    data.overall = overall;

    setTimeout(() => {
      document.getElementById('overall-score').textContent = overall;
      const ring = document.getElementById('score-ring');
      if (ring) {
        const circumference = 2 * Math.PI * 50; // r=50
        ring.style.strokeDashoffset = circumference - (overall / 100) * circumference;
      }
    }, 350);

    // Grade
    const grade =
      overall >= 88 ? '卓越' :
      overall >= 75 ? '優良' :
      overall >= 62 ? '進步中' : '需加強';
    document.getElementById('score-grade').textContent = grade;
    document.getElementById('score-summary-text').textContent = data.summary;

    // Suggestions
    const grid = document.getElementById('suggestions-grid');
    grid.innerHTML = '';
    grid.classList.add('stagger-children');
    data.suggestions.forEach(s => grid.appendChild(this._makeSuggestionCard(s)));

    // Score bars
    const barsEl = document.getElementById('score-bars');
    barsEl.innerHTML = '';
    const labels = {
      vocabulary: '詞彙豐富度',
      pacing:     '節奏感',
      emotion:    '情緒感染力',
      structure:  '結構清晰度',
      persuasion: '說服力',
    };
    Object.entries(data.scores).forEach(([k, v]) => {
      barsEl.appendChild(this._makeScoreBar(labels[k] || k, v));
    });

    // Animate bars after paint
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.querySelectorAll('.score-bar-fill').forEach(f => {
          f.style.width = f.dataset.width + '%';
        });
      }, 500);
    });
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

  _makeScoreBar(label, val) {
    const item = document.createElement('div');
    item.className = 'score-bar-item';
    item.innerHTML = `
      <div class="score-bar-label">${label}</div>
      <div class="score-bar-track">
        <div class="score-bar-fill" data-width="${val}" style="width:0%"></div>
      </div>
      <div class="score-bar-val">${val}</div>
    `;
    return item;
  },

  // ─── Progress rendering ─────────────────────────────────────

  renderProgress(data) {
    if (!data) return;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val ?? '--';
    };

    set('total-sessions', data.total_sessions);
    set('avg-score',      data.avg_score);
    set('best-score',     data.best_score);
    set('streak-days',    data.streak_days);

    const list = document.getElementById('sessions-list');
    if (!list) return;

    if (data.sessions && data.sessions.length > 0) {
      list.innerHTML = '';
      data.sessions.forEach(s => {
        const item = document.createElement('div');
        item.className = 'session-item animate-in';
        item.innerHTML = `
          <span class="session-date">${s.date}</span>
          <span class="session-speaker">${s.speaker}</span>
          <span class="score-badge">${s.score} 分</span>
        `;
        list.appendChild(item);
      });
    }
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
