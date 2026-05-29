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
    const name    = nameMap[speaker] || 'AI';
    const short   = transcript.slice(0, 120).trimEnd();

    const improvedTemplates = {
      trump: `各位，讓我告訴你們，這是非常、非常重要的事情——相信我。\n\n${short}...\n\n我們要做到最好，最棒的。沒有人比我們做得更好，這是事實。\n我的朋友們，我們會讓一切變得偉大。謝謝你們！`,
      mlk:   `我有一個夢想——一個關於明天的夢想，一個關於人類尊嚴的夢想。\n\n${short}...\n\n讓自由的鐘聲響徹每一個山谷，讓每一個靈魂都能站在陽光下，看見希望的彼岸。\n讓我們攜手，共同走向那光明的未來。`,
      xu:    `朋友們！你們今天相信自己嗎？！\n\n${short}...\n\n成功不是偶然的，是每一天的堅持、每一刻的突破！\n今天的選擇，決定了你明天的高度！加油，你可以的！`,
    };

    const vocabMap = {
      trump: [
        { original: '很好',   alternatives: ['卓越', '無與倫比', '史上最強'],  reason: '川普慣用最高級強調' },
        { original: '說',     alternatives: ['宣示', '告訴你們', '直說'],       reason: '更口語、直接、有力' },
        { original: '問題',   alternatives: ['災難', '大麻煩', '糟糕狀況'],     reason: '放大危機感' },
        { original: '改變',   alternatives: ['讓它偉大', '徹底翻轉', '重建'],   reason: '川普式行動語言' },
      ],
      mlk: [
        { original: '希望',   alternatives: ['夢想', '光明的彼岸', '自由的鐘聲'], reason: 'MLK 喜用詩意隱喻' },
        { original: '說',     alternatives: ['宣告', '呼喚', '見證'],            reason: '帶宗教感召的用詞' },
        { original: '努力',   alternatives: ['奮鬥', '前仆後繼', '不懈追求'],    reason: '情感張力更強' },
        { original: '一起',   alternatives: ['肩並肩', '攜手同行', '共同站立'],  reason: 'MLK 排比句核心詞彙' },
      ],
      xu: [
        { original: '可以',   alternatives: ['絕對做得到', '你辦得到', '你就是可以'], reason: '許智誠式正向強化' },
        { original: '努力',   alternatives: ['拼命衝', '全力爆發', '燃燒自己'],  reason: '熱情激昂的動詞' },
        { original: '成功',   alternatives: ['突破自己', '站上頂峰', '超越極限'], reason: '強調個人突破' },
        { original: '學習',   alternatives: ['吸收養分', '不斷進化', '打磨自己'], reason: '充滿行動感的替換' },
      ],
    };

    const suggestionsMap = {
      trump: [
        { icon: '🔁', category: '重複強調',  text: '選出你最核心的一句話，在演說中重複出現 3 次——川普慣用此法讓訊息深入人心。' },
        { icon: '💥', category: '簡短有力',  text: '把長句拆成兩三個短句。越短越有爆發力，讓台下每一句都能跟上你的節奏。' },
        { icon: '🦅', category: '對比語氣',  text: '善用「過去很糟——未來很棒」的對比句式，製造強烈的情緒落差。' },
        { icon: '🤝', category: '直接呼告',  text: '多說「讓我告訴你們」、「相信我」，建立你與聽眾之間的直接連結。' },
      ],
      mlk: [
        { icon: '🌊', category: '排比句式',  text: '用三個以上平行結構的句子推進論點，形成排山倒海的情感力量。' },
        { icon: '🕊️', category: '詩意意象',  text: '以具體的意象取代抽象概念——用「自由的鐘聲」而非「自由的概念」。' },
        { icon: '🔥', category: '情感高峰',  text: '在演說中段安排情緒最高點，之後用溫柔收尾，讓聽眾餘韻猶存。' },
        { icon: '✊', category: '集體認同',  text: '使用「我們」「我們的」凝聚共同體感，讓每位聽眾都覺得身在其中。' },
      ],
      xu: [
        { icon: '🎯', category: '故事開場',  text: '以一個真實的個人失敗故事開場——讓聽眾先感受低谷，再被你帶向高峰。' },
        { icon: '⚡', category: '節奏爆發',  text: '在關鍵句加快語速、拔高音量，製造情緒爆點，然後用沉默留白強調。' },
        { icon: '💪', category: '行動指令',  text: '每個段落結束前給出一個具體行動——「現在就做一件事：……」' },
        { icon: '🌟', category: '正向錨定',  text: '重複肯定聽眾的潛力，讓他們在離場時相信「我也可以做到」。' },
      ],
    };

    const summaryMap = {
      trump: `你的演說已有明確主題與立場。以川普風格調整後，重點在「強化重複感」與「拆短句子」——讓每一句都擲地有聲。`,
      mlk:   `你的演說具備真誠情感。以金恩博士風格調整後，重點在「詩意排比」與「意象語言」——讓話語能在聽眾心中迴盪。`,
      xu:    `你的演說展現出個人熱情。以許智誠風格調整後，重點在「故事帶動」與「行動指令」——讓聽眾從感動走向行動。`,
    };

    return {
      speaker,
      improved_transcript: improvedTemplates[speaker] || `（${name} 風格改善版本）\n\n${transcript}`,
      vocab_suggestions:   vocabMap[speaker]      || vocabMap.trump,
      suggestions:         suggestionsMap[speaker] || suggestionsMap.trump,
      summary:             summaryMap[speaker]     || `透過${name}風格的調整，你可以更有力地傳達核心訊息。`,
    };
  },

};

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
