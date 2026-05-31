/**
 * api.js — Backend API communication layer
 * Handles all HTTP requests to the Flask backend
 */

const API = {

  /**
   * Analyze transcript using specified speaker style
   */
  async analyze(transcript, speaker) {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript, speaker }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /**
   * Get user training progress
   */
  async getProgress() {
    const res = await fetch('/api/progress');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /**
   * Save completed training session
   */
  async saveSession(data) {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  /**
   * Transcribe audio file to text using Azure Speech-to-Text
   * @param {File} audioFile - Audio file to transcribe
   * @returns {Promise<{success: boolean, transcript?: string, error?: string}>}
   */
  async transcribe(audioFile) {
    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      let jsonData;
      try {
        jsonData = await res.json();
      } catch (parseError) {
        return {
          success: false,
          error: `伺服器回應錯誤 (HTTP ${res.status}): 無法解析回應格式`,
        };
      }
      
      if (!res.ok) {
        return {
          success: false,
          error: jsonData.error || `伺服器錯誤 (HTTP ${res.status})`,
        };
      }
      
      if (!jsonData.success) {
        return {
          success: false,
          error: jsonData.error || '轉錄失敗，請重試。',
        };
      }
      
      return {
        success: true,
        transcript: jsonData.transcript,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || '轉錄服務出錯，請重試。',
      };
    }
  },

  /**
   * Perform advanced linguistic analysis on transcript
   * Includes: filler words, vocabulary richness, sentiment, key phrases
   */
  async advancedAnalysis(transcript) {
    try {
      const res = await fetch('/api/advanced-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        return {
          success: false,
          error: error.error || '分析失敗',
        };
      }
      
      const data = await res.json();
      return {
        success: true,
        analysis: data.analysis,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || '分析服務出錯',
      };
    }
  },

  /**
   * Demo analysis fallback for development/testing
   */
  demoAnalysis(transcript, speaker) {
    const nameMap = { trump: '川普', mlk: '金恩博士', speaker_3: '黃仁勳' };
    const name    = nameMap[speaker] || 'AI';
    const short   = transcript.slice(0, 120).trimEnd();

    const improvedTemplates = {
      trump:     `各位，讓我告訴你們，這是非常、非常重要的事情——相信我。\n\n${short}...\n\n我們要做到最好，最棒的。沒有人比我們做得更好，這是事實。\n我的朋友們，我們會讓一切變得偉大。謝謝你們！`,
      mlk:       `我有一個夢想——一個關於明天的夢想，一個關於人類尊嚴的夢想。\n\n${short}...\n\n讓自由的鐘聲響徹每一個山谷，讓每一個靈魂都能站在陽光下，看見希望的彼岸。\n讓我們攜手，共同走向那光明的未來。`,
      speaker_3: `【平台轉移已經發生】\n\n${short}...\n\n這不是漸進式改善，這是整個 Full Stack 的重新發明。第一，我們必須看清楚趨勢。第二，我們要決定什麼不去做。第三，傾全力衝。\n\n跑起來，別用走的。`,
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
      speaker_3: [
        { original: '改變',   alternatives: ['平台位移', '全面重新發明', '根本性轉型'],  reason: '黃仁勳慣用規模化技術詞彙' },
        { original: '很多',   alternatives: ['350 倍', '4000 萬倍', '10 兆規模'],         reason: '以倍數與數字製造衝擊感' },
        { original: '進步',   alternatives: ['技術突破', '拐點', 'Scaling Law 展現'],     reason: '技術語境下的精確詞彙' },
        { original: '繼續',   alternatives: ['傾全力衝', '跑起來', '每年推進'],           reason: '黃仁勳式行動召喚語' },
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
      speaker_3: [
        { icon: '📊', category: '數據衝擊',  text: '在核心論點後立刻加上具體倍數或規模數字，讓聽眾感受到趨勢的量級。' },
        { icon: '📖', category: '三段故事',  text: '以「背景 → 危機 → 轉折 + 教訓」結構說一個真實的失敗故事，不迴避羞辱性細節。' },
        { icon: '⚡', category: '章節標題',  text: '每個主題切換時用粗體標題或【章節名】明確宣告，讓聽眾知道你在哪裡。' },
        { icon: '🚀', category: '行動召喚',  text: '結尾用「跑起來，別用走的」式的行動指令收尾，留下一句可帶走的話。' },
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
