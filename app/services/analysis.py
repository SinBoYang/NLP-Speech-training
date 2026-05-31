"""
演講逐字稿的進階語言學和情感分析服務。

提供的服務：
1. 冗詞分析 - 計算填充詞和連接詞
2. 詞彙豐富度 - 類型令牌比 (TTR) 分析
3. 情感分析 - 演講中的情緒軌跡
4. 關鍵詞 - 核心主題和強調模式
5. 數據vs情感 - 演講者類型分類
"""

import re
from collections import Counter
import jieba
from snownlp import SnowNLP
import nltk
from nltk.corpus import stopwords

# Download required NLTK data (first time only)
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt', quiet=True)

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords', quiet=True)


class TranscriptAnalyzer:
    """Analyzer for linguistic features, emotions, and rhetoric patterns."""
    
    # === REDUNDANCY LIBRARY ===
    # Comprehensive filler words and connectors with severity levels
    FILLER_WORDS = {
        '然後': {'severity': 'high', 'label': '連接詞'},
        '那': {'severity': 'high', 'label': '冗詞'},
        '就是': {'severity': 'high', 'label': '口頭禪'},
        '你知道': {'severity': 'high', 'label': '填充詞'},
        '就': {'severity': 'medium', 'label': '冗詞'},
        '其實': {'severity': 'medium', 'label': '填充詞'},
        '基本上': {'severity': 'medium', 'label': '冗詞'},
        '來說': {'severity': 'medium', 'label': '冗詞'},
        '的話': {'severity': 'low', 'label': '語氣詞'},
        '嗯': {'severity': 'low', 'label': '語氣詞'},
        '啊': {'severity': 'low', 'label': '語氣詞'},
        '呢': {'severity': 'low', 'label': '語氣詞'},
        '好吧': {'severity': 'low', 'label': '語氣詞'},
    }
    
    # Chinese stopwords (common words that don't carry meaning)
    ZH_STOPWORDS = {'的', '了', '和', '是', '在', '有', '人', '這', '中', '大', '要', '我', '他', '為', '來', '用', '們', '生', '到', '作', '一', '方', '面', '等', '又', '下', '去', '還', '多', '也', '很', '都', '可', '以', '無', '非', '此', '具', '等'}
    
    def __init__(self, transcript: str):
        """用逐字稿初始化分析器。"""
        self.transcript = transcript
        self.sentences = self._split_sentences()
        self.words = self._tokenize()
        
    def _split_sentences(self) -> list:
        """根據中文標點符號分割成句子。"""
        sentences = re.split(r'[。！？\n]+', self.transcript.strip())
        return [s.strip() for s in sentences if s.strip()]
    
    def _tokenize(self) -> list:
        """使用 jieba 進行中文分詞。"""
        words = jieba.cut(self.transcript)
        return [w.strip() for w in words if w.strip()]
    
    # ========== 服務 1: 冗詞分析 ==========
    def analyze_filler_words(self) -> dict:
        """
        分析冗詞和填充詞的頻率。
        
        返回:
            字典包含:
            - filler_words: (詞彙, 次數) 的排序列表
            - total_fillers: 冗詞總計
            - severity_warning: 冗詞程度評估
            - analysis: 詳細解釋
        """
        filler_counts = {}
        severity_mapping = {}
        
        for word, severity in self.FILLER_WORDS.items():
            count = self.transcript.count(word)
            if count > 0:
                filler_counts[word] = count
                severity_mapping[word] = severity
        
        # 計算冗餘指標
        total_redundant = sum(filler_counts.values())
        text_length = len(self.transcript)
        redundancy_ratio = (total_redundant / (text_length / 10)) if text_length > 0 else 0
        
        # 確定嚴重程度
        severity_warning = None
        if redundancy_ratio > 0.15:
            severity_warning = '[HIGH] 冗詞密度超過15%，建議大幅修改'
        elif redundancy_ratio > 0.10:
            severity_warning = '[MEDIUM] 冗詞密度介於10-15%，建議修改'
        elif redundancy_ratio > 0.05:
            severity_warning = '[LOW] 冗詞密度介於5-10%，可優化'
        
        return {
            'filler_words': sorted(filler_counts.items(), key=lambda x: x[1], reverse=True),
            'total_count': total_redundant,
            'ratio_percent': round(redundancy_ratio * 100, 2),
            'text_length': text_length,
            'severity_warning': severity_warning,
            'analysis': self._interpret_redundancy(filler_counts, text_length),
        }
    
    def _interpret_redundancy(self, filler_counts: dict, text_length: int) -> str:
        """生成冗詞模式的解釋。"""
        if not filler_counts:
            return '沒有檢測到明顯的冗詞。'
        
        interpretations = []
        
        # 檢查最常見的問題詞語
        if filler_counts.get('然後', 0) > 5:
            interpretations.append('「然後」出現過於頻繁 (%d次)，建議用其他銜接詞替代' % filler_counts.get('然後', 0))
        
        if filler_counts.get('那', 0) > 3:
            interpretations.append('「那」字使用次數較多 (%d次)，可考慮用具體過渡詞彙替代' % filler_counts.get('那', 0))
        
        if filler_counts.get('就是', 0) > 5:
            interpretations.append('「就是」出現頻繁 (%d次)，過度重複會削弱說服力' % filler_counts.get('就是', 0))
        
        if filler_counts.get('你知道', 0) > 3:
            interpretations.append('「你知道」出現 %d 次，建議減少此類填充詞' % filler_counts.get('你知道', 0))
        
        return ' | '.join(interpretations) if interpretations else '冗詞使用在正常範圍內。'
    
    # ========== 服務 2: 詞彙豐富度 ==========
    def analyze_vocabulary_richness(self) -> dict:
        """
        計算詞彙多樣性的 TTR (類型令牌比)。
        
        TTR = 獨特詞彙數 / 總詞彙數
        - TTR < 0.3: 詞彙貧乏，重複性高
        - TTR 0.3-0.5: 正常水平
        - TTR > 0.5: 詞彙豐富
        
        返回:
            字典包含:
            - type_token_ratio: TTR 分數 (0-1)
            - total_words: 有意義詞彙總數
            - unique_words: 獨特詞彙數
            - richness_level: 分類評估
            - top_words: 最常見詞彙
            - analysis: 詳細解釋
        """
        # 去除停用詞進行有意義的分析
        meaningful_words = [
            w for w in self.words
            if w not in self.ZH_STOPWORDS and len(w) > 1
        ]
        
        total_words = len(meaningful_words)
        unique_words = len(set(meaningful_words))
        ttr = unique_words / total_words if total_words > 0 else 0
        
        word_freq = Counter(meaningful_words).most_common(10)
        
        return {
            'type_token_ratio': round(ttr, 3),
            'total_words': total_words,
            'unique_words': unique_words,
            'richness_level': self._categorize_richness(ttr),
            'top_words': word_freq,
            'analysis': self._interpret_vocabulary_richness(ttr, word_freq),
        }
    
    def _categorize_richness(self, ttr: float) -> str:
        """分類詞彙豐富度級別。"""
        if ttr < 0.3:
            return '[LOW] 詞彙貧乏'
        elif ttr < 0.5:
            return '[NORMAL] 正常水平'
        else:
            return '[HIGH] 詞彙豐富'
    
    def _interpret_vocabulary_richness(self, ttr: float, top_words: list) -> str:
        """提供詞彙模式的解釋。"""
        if ttr < 0.3:
            return '詞彙重複性強，建議豐富用詞以提升表達多樣性'
        elif ttr > 0.5:
            return '詞彙使用非常豐富，展現強大的語言表現力'
        else:
            top_3 = ', '.join([w[0] for w in top_words[:3]])
            return f'詞彙多樣性適中。最常使用詞彙：{top_3}'
    
    # ========== 服務 3: 關鍵詞提取 =========="
    def extract_key_phrases(self) -> dict:
        """
        提取關鍵詞並識別演講焦點模式。
        判斷演講者是通過重複強調 (聚焦型) 還是涵蓋多個主題 (發散型)。
        
        返回:
            字典包含:
            - key_phrases: 頻繁重複的短語及其頻率
            - focus_score: 焦點級別指標
            - speech_style: 分類 (聚焦型/平衡型/發散型)
            - analysis: 詳細解釋
        """
        meaningful_words = [
            w for w in self.words
            if w not in self.ZH_STOPWORDS and len(w) > 1
        ]
        
        word_freq = Counter(meaningful_words)
        key_phrases = {
            w: count for w, count in word_freq.most_common(20)
            if count >= 2
        }
        
        # 計算焦點分數
        if key_phrases:
            avg_frequency = sum(key_phrases.values()) / len(key_phrases)
            focus_score = min(avg_frequency / len(meaningful_words) * 100, 100)
        else:
            focus_score = 0
        
        return {
            'key_phrases': sorted(key_phrases.items(), key=lambda x: x[1], reverse=True)[:15],
            'focus_score': round(focus_score, 1),
            'speech_style': self._classify_speech_style(focus_score, len(key_phrases)),
            'analysis': self._analyze_key_phrases(key_phrases, len(meaningful_words)),
        }
    
    def _classify_speech_style(self, focus_score: float, phrase_count: int) -> str:
        """將演講模式分類為聚焦型或發散型。"""
        if focus_score > 15:
            return '[FOCUSED] 聚焦型：重複強調核心訊息'
        elif focus_score > 8:
            return '[BALANCED] 平衡型：核心主題清晰，有適當變化'
        else:
            return '[DISPERSIVE] 發散型：涉及廣泛主題，變化多樣'
    
    def _analyze_key_phrases(self, key_phrases: dict, total_words: int) -> str:
        """提供關鍵詞模式的解釋。"""
        if not key_phrases:
            return '未檢測到明顯的重複關鍵詞'
        
        top_phrase = max(key_phrases.items(), key=lambda x: x[1])
        repetition_rate = (top_phrase[1] / total_words * 100) if total_words > 0 else 0
        
        if repetition_rate > 10:
            return f'對「{top_phrase[0]}」的強調突出（占詞彙{round(repetition_rate, 1)}%），呈現集中強調風格'
        elif repetition_rate > 5:
            return f'適度重複關鍵詞「{top_phrase[0]}」（占詞彙{round(repetition_rate, 1)}%），有利於加深聽眾印象'
        else:
            return '話題較為發散，涵蓋多個不同主題和議題'
    
    # ========== 服務 5: 數據vs情感分類 ==========
    def detect_data_vs_emotion(self) -> dict:
        """
        將演講者分類為數據導向或情感導向。
        數據導向演講者引用數字、組織、事實。
        情感導向演講者使用故事、個人經歷、情感詞彙。
        
        返回:
            字典包含:
            - numbers_count: 數字引用次數
            - organizations_count: 組織/實體引用次數
            - emotion_words_count: 情感詞彙計數
            - data_ratio: 表示數據強調的百分比
            - emotion_ratio: 表示情感強調的百分比
            - speaker_type: 分類類別
            - analysis: 詳細解釋
        """
        # 計算數字
        numbers = re.findall(r'\d+', self.transcript)
        number_count = len(numbers)
        
        # 檢測組織/專有名詞
        orgs = re.findall(r'(?:公司|企業|機構|組織|機關)[^\s]*', self.transcript)
        org_count = len(orgs)
        
        # 檢測情感/故事詞語
        emotion_words = {'感動', '失敗', '成功', '勇氣', '希望', '夢想', '故事', '經歷', '相信', '堅持', '感謝', '愛', '驕傲', '珍惜'}
        emotion_count = sum(1 for word in self.words if word in emotion_words)
        
        # 分數計算
        data_score = (number_count * 0.4 + org_count * 0.6) * 10
        emotion_score = emotion_count * 10
        total_score = data_score + emotion_score if (data_score + emotion_score) > 0 else 1
        data_ratio = data_score / total_score * 100
        
        return {
            'numbers_count': number_count,
            'organizations_count': org_count,
            'emotion_words_count': emotion_count,
            'data_ratio': round(data_ratio, 1),
            'emotion_ratio': round(100 - data_ratio, 1),
            'speaker_type': self._classify_speaker_type(data_ratio),
            'analysis': self._analyze_speaker_approach(number_count, org_count, emotion_count),
        }
    
    def _classify_speaker_type(self, ratio: float) -> str:
        """根據數據對情感比例分類演講者類型。"""
        if ratio > 60:
            return '[DATA-DRIVEN] 數據事實派'
        elif ratio > 40:
            return '[HYBRID] 混合型'
        else:
            return '[EMOTION-DRIVEN] 情感故事派'
    
    def _analyze_speaker_approach(self, num_count: int, org_count: int, emotion_count: int) -> str:
        """提供數據與情感平衡的分析。"""
        facts = num_count + org_count
        
        if facts > 0 and emotion_count > 0:
            return f'兼具數據說服力與情感共鳴：{num_count}個數字、{org_count}個組織、{emotion_count}個情感詞彙'
        elif facts > emotion_count:
            return f'強調數據與事實（{facts}個元素），適合技術型或商業演講'
        elif emotion_count > facts:
            return f'側重情感故事（{emotion_count}個情感詞彙），易於引起聽眾共鳴'
        else:
            return '數據與情感要素有限，建議增加具體案例或數據支撐'
    
    # ========== 報告生成 ==========
    def generate_full_report(self) -> dict:
        """
        生成結合所有服務的綜合分析報告。
        
        返回:
            包含所有 5 項分析服務結果的字典
        """
        return {
            'redundancy_analysis': self.analyze_filler_words(),
            'vocabulary_richness': self.analyze_vocabulary_richness(),
            'key_phrases': self.extract_key_phrases(),
            'speaker_profile': self.detect_data_vs_emotion(),
        }
