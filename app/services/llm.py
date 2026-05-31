"""Gemini API service — speech analysis (call 1) + style rewriting (call 2)."""
import os
import re
import json
import google.generativeai as genai

from app.services.speaker_styles import SPEAKER_STYLES

# ---------------------------------------------------------------------------
# Call 1 — Analysis prompt (no rewriting)
# ---------------------------------------------------------------------------

ANALYSIS_PROMPT = """
你是一位專業演說分析師。你的唯一任務是分析演說稿，不做任何改寫。

## 分析項目

### 1. 結構
評估開場 / 主體 / 結尾是否清晰，論點是否有層次遞進。

### 2. 詞彙與語言強度
- 被動句與消極詞彙使用頻率（標記具體位置）
- 語言精確度：是否使用模糊詞彙代替具體陳述

### 3. 節奏
- 建議停頓位置（依語句密度與長度）
- 標記多餘的連接詞或重複句型

### 4. 情緒弧線
- 輸出情緒分數時間軸（1–10，依全文比例切分）
- 判斷是否有情緒遞升感

### 5. 說服力（Ethos / Pathos / Logos）
- Ethos：是否建立演講者可信度
- Pathos：情感共鳴程度（附上依據句子）
- Logos：是否有具體數據、案例、邏輯支撐

### 6. 關鍵弱點
列出最需優先改善的三個問題，每個附上原文引句與說明。

## 規則
- 評分需有對應說明，不給無根據的滿分
- 逐字稿空白或過短（< 30 字）：回傳 `"transcript_too_short": true`
- 輸入為 zh-TW → 使用繁體中文輸出

## 輸出格式（JSON）

```json
{
  "analysis": {
    "structure":  { "score": 0, "feedback": "", "suggestions": [] },
    "vocabulary": { "score": 0, "feedback": "", "weak_phrases": [] },
    "rhythm":     { "score": 0, "feedback": "", "pause_suggestions": [] },
    "emotion_arc":{ "score": 0, "timeline": [], "feedback": "" },
    "persuasion": {
      "ethos":  { "score": 0, "feedback": "" },
      "pathos": { "score": 0, "feedback": "", "source_quote": "" },
      "logos":  { "score": 0, "feedback": "" }
    },
    "top_issues": [
      { "rank": 1, "quote": "", "issue": "", "reason": "" },
      { "rank": 2, "quote": "", "issue": "", "reason": "" },
      { "rank": 3, "quote": "", "issue": "", "reason": "" }
    ],
    "overall_score": 0
  },
  "voice_profile": {
    "tone": "",
    "pace": 0,
    "pitch": "",
    "pause_intensity": "",
    "emotion_curve": "",
    "voice_model_tag": ""
  }
}
```
"""

# ---------------------------------------------------------------------------
# Call 2 — Rewrite prompt (no analysis)
# ---------------------------------------------------------------------------

REWRITE_SYSTEM = """
你是一位風格改寫專家。你的唯一任務是：將輸入的句子清單，逐句改寫成目標演說家的風格。

## 鐵律
- 每一句都必須改寫，沒有例外
- rewritten 不得與 original 相同或高度相似
- 只改語言風格與句型結構，不改核心意思
- 不得合併句子或跳過句子，輸入幾句就輸出幾句

## 輸出格式（JSON 陣列）
```json
[
  {"original": "原句", "rewritten": "改寫後的句子"},
  {"original": "原句", "rewritten": "改寫後的句子"}
]
```
"""

REWRITE_EXAMPLES = {
    "trump": """\
## 風格改寫示範（川普）

原句：各位好，今天我想聊聊標準答案這個話題。
改寫：各位，聽著，標準答案——我要告訴你們——這是個巨大的謊言，巨大的。

原句：從小到大我們被一套公式餵養長大。
改寫：他們從我們小的時候就開始這樣做了。從小。一套公式。強迫你接受。沒有人告訴你為什麼，沒有人。

原句：考試的時候，翻到課本第幾頁就會有正確解答。
改寫：翻到課本——第幾頁——就有答案。他們說這就是對的。這就是全部。完全錯誤，相信我。

原句：這個問題需要我們認真思考。
改寫：我們要思考這個問題。認真思考。非常認真。沒有人比我們更認真，這是事實。\
""",

    "mlk": """\
## 風格改寫示範（金恩博士）

原句：各位好，今天我想聊聊標準答案這個話題。
改寫：今天，在這個時刻，我們聚在一起，是為了面對一個深埋在我們靈魂深處的問題——那個叫做「標準答案」的枷鎖。

原句：從小到大我們被一套公式餵養長大。
改寫：從我們張開眼睛看見這個世界的那一天起，有人便為我們畫好了框架。我們在框架裡長大。我們在框架裡呼吸。我們在框架裡學習什麼叫做「正確」。

原句：考試的時候，翻到課本第幾頁就會有正確解答。
改寫：他們告訴我們：翻開第幾頁，真理就在那裡。但我問你——真理，能被裝進一個頁碼嗎？正義，能被壓縮進一個選項嗎？

原句：這個問題需要我們認真思考。
改寫：現在正是時候——不是明天，不是等我們更有準備的時候——是今天，是此刻，我們必須直視這個問題。\
""",

    "xu": """\
## 風格改寫示範（黃仁勳）

原句：各位好，今天我想聊聊標準答案這個話題。
改寫：【Platform Shift】讓我告訴你一件事。「標準答案」這個概念，正在被重新發明。整個框架，正在崩塌。

原句：從小到大我們被一套公式餵養長大。
改寫：第一，我們被訓練去找答案。第二，我們被訓練去背答案。第三，我們從來沒有被訓練去質疑答案存不存在。這是系統性的問題，不是個人的問題。

原句：考試的時候，翻到課本第幾頁就會有正確解答。
改寫：舊模型是這樣運作的：輸入問題，查找頁碼，輸出答案。End-to-End，乾淨俐落。問題是，現實世界沒有頁碼。

原句：這個問題需要我們認真思考。
改寫：幸運的是，我們知道方向。第一，承認舊框架已失效。第二，重新定義什麼叫做「對」。跑起來，別用走的。\
""",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _split_sentences(text: str) -> list[str]:
    parts = re.split(r'(?<=[。？！\.\?!])\s*|\n+', text.strip())
    return [s.strip() for s in parts if s.strip()]


def _make_model(api_key: str) -> "genai.GenerativeModel":
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        generation_config={"response_mime_type": "application/json"},
    )


# ---------------------------------------------------------------------------
# Call 1 — Analysis
# ---------------------------------------------------------------------------

def _call_analysis(model, transcript: str) -> dict:
    prompt = ANALYSIS_PROMPT + f"\n\n---\n## 演說稿\n{transcript}"
    response = model.generate_content(prompt)
    return json.loads(response.text)


# ---------------------------------------------------------------------------
# Call 2 — Rewriting
# ---------------------------------------------------------------------------

def _call_rewrite(model, transcript: str, speaker: str) -> dict:
    style = SPEAKER_STYLES.get(speaker, "")
    examples = REWRITE_EXAMPLES.get(speaker, "")

    sentences = _split_sentences(transcript)
    numbered = "\n".join(f"{i+1}. {s}" for i, s in enumerate(sentences))

    prompt = (
        REWRITE_SYSTEM
        + f"\n\n---\n## 目標演說家風格\n{style}\n"
        + f"\n{examples}\n"
        + f"\n---\n## 現在請改寫以下 {len(sentences)} 句，每句都必須改寫：\n\n{numbered}\n"
    )

    response = model.generate_content(prompt)
    sentences_result = json.loads(response.text)

    content = "\n".join(
        s.get("rewritten", s.get("original", ""))
        for s in sentences_result
    )
    change_log = [
        {"original": s.get("original", ""), "revised": s.get("rewritten", ""), "reason": ""}
        for s in sentences_result
    ]

    return {
        "speaker_style": speaker,
        "content": content,
        "sentences": sentences_result,
        "style_patterns_used": [],
        "change_log": change_log,
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def analyze_transcript(transcript: str, speaker: str = "trump") -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY not set")

    model = _make_model(api_key)

    analysis_result = _call_analysis(model, transcript)

    if analysis_result.get("transcript_too_short"):
        return analysis_result

    rewrite_result = _call_rewrite(model, transcript, speaker)

    analysis_result["rewritten_transcript"] = rewrite_result
    return analysis_result
