/**
 * api.js — Backend communication layer
 * Falls back to demo data when the API is unavailable.
 */

const API = {

  async analyze(transcript, speaker) {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, speaker }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async getProgress() {
    const res = await fetch('/api/progress');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async saveSession(data) {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /** Demo payload used when backend returns an error or non-200 */
  demoAnalysis(transcript, speaker) {
    const nameMap = { trump: '川普', mlk: '金恩博士', xu: '許智誠' };
    const name = nameMap[speaker] || speaker;
    const short = transcript.slice(0, 120).trimEnd();

    const templates = {
      trump: `各位，讓我告訴你們，這是非常、非常重要的事情——相信我。\n\n${short}...\n\n我們要做到最好，最棒的。沒有人比我們做得更好，這是事實。\n我的朋友們，我們會讓一切變得偉大。謝謝你們！`,
      mlk: `我有一個夢想——一個關於明天的夢想，一個關於人類尊嚴的夢想。\n\n${short}...\n\n讓自由的鐘聲響徹每一個山谷，讓每一個靈魂都能站在陽光下，看見希望的彼岸。\n讓我們攜手，共同走向那光明的未來。`,
      xu: `朋友們！你們今天相信自己嗎？！\n\n${short}...\n\n成功不是偶然的，是每一天的堅持、每一刻的突破！\n今天的選擇，決定了你明天的高度！加油，你可以的！`,
    };

    const improved = templates[speaker] || `（${name} 風格改善版本）\n\n${transcript}`;

    const scores = {
      vocabulary: rand(58, 80),
      pacing:     rand(52, 78),
      emotion:    rand(55, 82),
      structure:  rand(60, 85),
      persuasion: rand(56, 80),
    };

    return {
      improved_transcript: improved,
      suggestions: [
        { category: '語言表達', icon: '📝', text: `善用${name}標誌性的有力動詞與簡潔名詞，讓每個字都有份量。` },
        { category: '情緒張力', icon: '🎭', text: '在關鍵論點前加入情緒鋪墊，讓聽眾在情感上做好接收準備。' },
        { category: '節奏控制', icon: '⏱️', text: '善用停頓來強調重點。在核心句子結束後停頓 0.5–1 秒，效果顯著。' },
        { category: '邏輯結構', icon: '🏗️', text: '嘗試「問題—衝突—解決」三段式結構，讓論述更具說服力。' },
        { category: '開場白', icon: '🚀', text: '用一個引人入勝的故事或驚人數據作為開場，在前 30 秒抓住聽眾注意力。' },
      ],
      scores,
      summary: `你的演說展現了真誠的表達和清晰的主題。透過${name}風格的調整，你可以更有力地傳達核心訊息，讓聽眾留下深刻印象。`,
    };
  },

  demoProgress(latestResult, speaker) {
    const nameMap = { trump: '川普', mlk: '金恩博士', xu: '許智誠' };
    const sessions = latestResult ? [{
      date: new Date().toLocaleDateString('zh-TW'),
      speaker: nameMap[speaker] || speaker,
      score: latestResult.overall,
    }] : [];

    return {
      total_sessions: sessions.length,
      avg_score: latestResult?.overall ?? '--',
      best_score: latestResult?.overall ?? '--',
      streak_days: 1,
      sessions,
    };
  },
};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
