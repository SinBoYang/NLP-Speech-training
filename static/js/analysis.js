/**
 * 高級分析結果渲染模塊
 * 將API返回的分析數據渲染到前端卡片
 */

const AnalysisRenderer = {
  /**
   * 渲染冗詞分析結果
   */
  renderRedundancy(data) {
    const container = document.getElementById('redundancy-analysis');
    if (!data || data.error) {
      container.innerHTML = '<p class="placeholder">分析失敗</p>';
      return;
    }

    const fillers = data.filler_words || [];
    const topFillers = fillers.slice(0, 5);
    
    let html = `<div class="analysis-items">`;
    
    if (topFillers.length > 0) {
      topFillers.forEach(([word, count]) => {
        html += `<div class="analysis-item">
          <span class="analysis-item-word">${word}</span>
          <span class="analysis-item-count"> × ${count}次</span>
        </div>`;
      });
    }
    
    html += `</div>`;
    
    if (data.severity_warning) {
      html += `<div class="analysis-badge ${data.severity_warning.includes('HIGH') ? 'high' : data.severity_warning.includes('MEDIUM') ? 'medium' : 'low'}">
        ${data.severity_warning.substring(1, data.severity_warning.indexOf(']'))}
      </div>`;
    }
    
    html += `<div class="analysis-stat">
      <span class="analysis-stat-label">冗詞密度</span>
      <span class="analysis-stat-value">${data.ratio_percent || 0}%</span>
    </div>`;
    
    if (data.analysis) {
      html += `<p style="margin: 8px 0; font-size: 0.8rem; color: var(--text-3);">${data.analysis}</p>`;
    }
    
    container.innerHTML = html;
  },

  /**
   * 渲染詞彙豐富度分析
   */
  renderVocabulary(data) {
    const container = document.getElementById('vocabulary-analysis');
    if (!data || data.error) {
      container.innerHTML = '<p class="placeholder">分析失敗</p>';
      return;
    }

    const ttr = (data.type_token_ratio || 0).toFixed(3);
    const level = data.richness_level || '未知';
    
    let html = `
      <div class="analysis-stat">
        <span class="analysis-stat-label">TTR 指數</span>
        <span class="analysis-stat-value">${ttr}</span>
      </div>
      <div class="analysis-meter">
        <span class="analysis-meter-label">豐富度</span>
        <div class="analysis-meter-bar">
          <div class="analysis-meter-fill" style="width: ${Math.min(ttr * 100, 100)}%"></div>
        </div>
        <span class="analysis-meter-value">${Math.round(Math.min(ttr * 100, 100))}%</span>
      </div>
      <div class="analysis-badge ${level.includes('LOW') ? 'low' : level.includes('HIGH') ? 'high' : 'medium'}">
        ${level.split(']')[0].substring(1)}
      </div>
    `;
    
    if (data.analysis) {
      html += `<p style="margin-top: 8px; font-size: 0.8rem; color: var(--text-3);">${data.analysis}</p>`;
    }
    
    container.innerHTML = html;
  },

  /**
   * 渲染關鍵詞提取結果
   */
  renderKeyPhrases(data) {
    const container = document.getElementById('phrases-analysis');
    if (!data || data.error) {
      container.innerHTML = '<p class="placeholder">分析失敗</p>';
      return;
    }

    const phrases = data.key_phrases || [];
    const topPhrases = phrases.slice(0, 6);
    const focusScore = (data.focus_score || 0).toFixed(1);
    const style = data.speech_style || '未分類';
    
    let html = `<div class="analysis-items">`;
    
    topPhrases.forEach(([phrase, count]) => {
      html += `<div class="analysis-item">
        <span class="analysis-item-word">${phrase}</span>
        <span class="analysis-item-count"> × ${count}次</span>
      </div>`;
    });
    
    html += `</div>
      <div class="analysis-meter">
        <span class="analysis-meter-label">焦點</span>
        <div class="analysis-meter-bar">
          <div class="analysis-meter-fill" style="width: ${Math.min(focusScore * 5, 100)}%"></div>
        </div>
        <span class="analysis-meter-value">${focusScore}</span>
      </div>
      <div class="speech-style-tag">${style}</div>
    `;
    
    if (data.analysis) {
      html += `<p style="margin-top: 8px; font-size: 0.8rem; color: var(--text-3);">${data.analysis}</p>`;
    }
    
    container.innerHTML = html;
  },

  /**
   * 渲染數據vs情感分析
   */
  renderSpeakerProfile(data) {
    const container = document.getElementById('speaker-analysis');
    if (!data || data.error) {
      container.innerHTML = '<p class="placeholder">分析失敗</p>';
      return;
    }

    const dataRatio = data.data_ratio || 50;
    const emotionRatio = 100 - dataRatio;
    const speakerType = data.speaker_type || '未分類';
    
    let html = `
      <div class="analysis-stat">
        <span class="analysis-stat-label">演講者類型</span>
      </div>
      <div style="margin-bottom: 10px;"></div>
    `;
    
    html += `<div class="ratio-display">
      <div class="ratio-bar">
        <div class="ratio-data" style="flex: ${dataRatio};"></div>
        <div class="ratio-emotion" style="flex: ${emotionRatio};"></div>
      </div>
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-3); margin-bottom: 10px;">
      <span>數據 ${dataRatio.toFixed(1)}%</span>
      <span>情感 ${emotionRatio.toFixed(1)}%</span>
    </div>
    <div class="speech-style-tag">${speakerType}</div>
    `;
    
    if (data.analysis) {
      html += `<p style="margin-top: 8px; font-size: 0.8rem; color: var(--text-3);">${data.analysis}</p>`;
    }
    
    container.innerHTML = html;
  },

  /**
   * 渲染詞彙地圖
   */
  renderWordCloud(topWords) {
    if (!topWords || topWords.length === 0) {
      document.getElementById('word-cloud').innerHTML = '<span class="wc-empty">沒有檢測到詞彙</span>';
      return;
    }

    const maxFreq = Math.max(...topWords.map(w => w[1]));
    let html = '';
    
    topWords.slice(0, 30).forEach(([word, count]) => {
      const ratio = count / maxFreq;
      let sizeClass = 'wc-1';
      if (ratio > 0.8) sizeClass = 'wc-5';
      else if (ratio > 0.6) sizeClass = 'wc-4';
      else if (ratio > 0.4) sizeClass = 'wc-3';
      else if (ratio > 0.2) sizeClass = 'wc-2';
      
      html += `<span class="wc-word ${sizeClass}" title="${word}: ${count}次">${word}</span>`;
    });
    
    document.getElementById('word-cloud').innerHTML = html;
  }
};

/**
 * 觸發分析並渲染結果
 */
async function performAdvancedAnalysis() {
  const transcript = document.getElementById('transcript').value.trim();
  
  if (!transcript || transcript.length < 10) {
    alert('逐字稿過短，請至少輸入 10 個字');
    return;
  }

  try {
    const response = await fetch('/api/advanced-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('分析失敗:', result.error);
      alert('分析失敗：' + (result.error || '未知錯誤'));
      return;
    }

    const analysis = result.analysis;

    // 渲染所有分析結果
    if (analysis.redundancy_analysis) {
      AnalysisRenderer.renderRedundancy(analysis.redundancy_analysis);
    }

    if (analysis.vocabulary_richness) {
      AnalysisRenderer.renderVocabulary(analysis.vocabulary_richness);
      // 也用於詞彙地圖
      if (analysis.vocabulary_richness.top_words) {
        AnalysisRenderer.renderWordCloud(analysis.vocabulary_richness.top_words);
      }
    }

    if (analysis.key_phrases) {
      AnalysisRenderer.renderKeyPhrases(analysis.key_phrases);
    }

    if (analysis.speaker_profile) {
      AnalysisRenderer.renderSpeakerProfile(analysis.speaker_profile);
    }

  } catch (error) {
    console.error('分析錯誤:', error);
    alert('分析失敗，請稍後重試');
  }
}

// 導出函數供外部調用
window.performAdvancedAnalysis = performAdvancedAnalysis;
