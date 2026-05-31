"""Azure OpenAI service — speech analysis (call 1) + style rewriting (call 2)."""
import os
import re
import json
from openai import AzureOpenAI

from app.services.speaker_styles import SPEAKER_STYLES

# ---------------------------------------------------------------------------
# Initialize Azure OpenAI Client
# ---------------------------------------------------------------------------

def _make_client() -> AzureOpenAI:
    return AzureOpenAI(
        api_key=os.environ.get("AZURE_OPENAI_KEY"),
        api_version="2024-02-15-preview",
        azure_endpoint=os.environ.get("AZURE_OPENAI_ENDPOINT"),
    )

# ---------------------------------------------------------------------------
# Call 1 — Analysis prompt (no rewriting)
# ---------------------------------------------------------------------------

ANALYSIS_PROMPT = """
你是演說分析師。分析演說稿，不改寫。

分析項目：
1. 結構：開場/主體/結尾清晰度，論點遞進
2. 詞彙：被動句、消極詞彙、模糊用語位置
3. 節奏：句型重複、連接詞冗餘位置
4. 情感：情緒弧線(1-10)、遞升感
5. 說服力：Ethos(可信度)、Pathos(共鳴)、Logos(證據)
6. 三大弱點：各附原句引述與說明

JSON 輸出格式：
{
  "analysis": {
    "structure": {"score": 0, "feedback": ""},
    "vocabulary": {"score": 0, "feedback": ""},
    "rhythm": {"score": 0, "feedback": ""},
    "emotion_arc": {"score": 0, "feedback": ""},
    "persuasion": {"ethos": {"score": 0}, "pathos": {"score": 0}, "logos": {"score": 0}},
    "top_issues": [{"rank": 1, "quote": "", "issue": "", "reason": ""}, {"rank": 2, ...}, {"rank": 3, ...}],
    "overall_score": 0
  }
}

規則：評分附說明；短稿(<30字)標記 transcript_too_short；用繁體中文。
"""

# ---------------------------------------------------------------------------
# Call 2 — Rewrite prompt (no analysis)
# ---------------------------------------------------------------------------

REWRITE_SYSTEM = """
你是改寫專家。根據分析結果改進內容，再用目標風格表達。

鐵律：
1. 逐句改寫，改進內容品質（詞彙、節奏、說服力、情感）
2. 用目標風格重新表達
3. 改寫結果不同於原句
4. 輸入N句，輸出N句

JSON 格式（必須是物件，sentences 為陣列）：
{"sentences": [{"original": "原句", "rewritten": "改寫"}, ...]}
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

# ---------------------------------------------------------------------------
# Call 1 — Analysis
# ---------------------------------------------------------------------------

def _call_analysis(client: AzureOpenAI, transcript: str) -> dict:
    prompt = ANALYSIS_PROMPT + f"\n\n---\n## 演說稿\n{transcript}"
    
    response = client.chat.completions.create(
        model=os.environ.get("AZURE_OPENAI_DEPLOYMENT"),
        messages=[
            {"role": "system", "content": "你是一位專業演說分析師。以 JSON 格式輸出分析結果。"},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        response_format={"type": "json_object"},
    )
    
    return json.loads(response.choices[0].message.content)

# ---------------------------------------------------------------------------
# Call 2 — Rewriting (with analysis guidance)
# ---------------------------------------------------------------------------

def _call_rewrite(client: AzureOpenAI, transcript: str, speaker: str, analysis_result: dict) -> dict:
    """改寫逐字稿，根據分析結果進行有針對性的修改。"""
    style = SPEAKER_STYLES.get(speaker, "")
    examples = REWRITE_EXAMPLES.get(speaker, "")

    sentences = _split_sentences(transcript)
    numbered = "\n".join(f"{i+1}. {s}" for i, s in enumerate(sentences))

    # 提取分析結果中的關鍵要點
    analysis = analysis_result.get('analysis', {})
    vocab_feedback = analysis.get('vocabulary', {}).get('feedback', '')
    rhythm_feedback = analysis.get('rhythm', {}).get('feedback', '')
    emotion_feedback = analysis.get('emotion_arc', {}).get('feedback', '')
    persuasion = analysis.get('persuasion', {})
    ethos_feedback = persuasion.get('ethos', {}).get('feedback', '')
    pathos_feedback = persuasion.get('pathos', {}).get('feedback', '')
    logos_feedback = persuasion.get('logos', {}).get('feedback', '')
    top_issues = analysis.get('top_issues', [])

    # 組建分析指導部分
    improvement_guidance = """## 根據分析結果需要改進的地方\n"""
    
    if vocab_feedback:
        improvement_guidance += f"\n【詞彙與語言】\n{vocab_feedback}\n"
    
    if rhythm_feedback:
        improvement_guidance += f"\n【節奏與句型】\n{rhythm_feedback}\n"
    
    if emotion_feedback:
        improvement_guidance += f"\n【情感弧線】\n{emotion_feedback}\n"
    
    persuasion_guidance = []
    if ethos_feedback:
        persuasion_guidance.append(f"建立可信度：{ethos_feedback}")
    if pathos_feedback:
        persuasion_guidance.append(f"情感共鳴：{pathos_feedback}")
    if logos_feedback:
        persuasion_guidance.append(f"邏輯支撐：{logos_feedback}")
    
    if persuasion_guidance:
        improvement_guidance += f"\n【說服力（Ethos/Pathos/Logos）】\n" + "\n".join(persuasion_guidance) + "\n"
    
    if top_issues:
        improvement_guidance += "\n【優先修改的問題】\n"
        for issue in top_issues[:3]:
            issue_text = f"\n- {issue.get('issue', '問題')}：{issue.get('reason', '')}\n  原句：\"{issue.get('quote', '')}\""
            improvement_guidance += issue_text

    prompt = (
        REWRITE_SYSTEM
        + f"\n\n---\n## 目標演說家風格參考\n{style}\n"
        + f"\n{examples}\n"
        + f"\n---\n{improvement_guidance}\n"
        + f"\n---\n## 改寫要求（重要）\n"
        + f"你現在將根據上述分析結果改進以下 {len(sentences)} 句話。\n\n"
        + f"改寫的步驟：\n"
        + f"第一步：閱讀每一句，對照「根據分析結果需要改進的地方」中的具體問題\n"
        + f"第二步：改進該句以解決指出的問題（詞彙、節奏、說服力、情感等）\n"
        + f"第三步：用上述「目標演說家風格」重新表達改進後的句子\n"
        + f"第四步：確保改寫後的句子與原句不同，且解決了分析指出的問題\n\n"
        + f"特別提醒：\n"
        + f"- 不要只改風格，還要改內容以解決分析指出的弱點\n"
        + f"- 可以改變句子結構、添加例子或細節，只要不改變核心訊息\n"
        + f"- 每句都必須改寫，不能保留原句\n"
        + f"- 目標是產出既改進了內容，又有目標風格的新版本\n\n"
        + f"現在請改寫以下 {len(sentences)} 句：\n\n{numbered}\n"
    )

    response = client.chat.completions.create(
        model=os.environ.get("AZURE_OPENAI_DEPLOYMENT"),
        messages=[
            {"role": "system", "content": "你是一位風格改寫專家。必須以 JSON 物件格式輸出，格式為 {\"sentences\": [{\"original\": \"原句\", \"rewritten\": \"改寫\"}]}。"},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        response_format={"type": "json_object"},
    )
    
    response_data = json.loads(response.choices[0].message.content)
    
    # Handle different response formats from Azure OpenAI
    sentences_result = []
    
    if isinstance(response_data, list):
        sentences_result = response_data
    elif isinstance(response_data, dict):
        # Try known wrapper keys in priority order
        for key in ("sentences", "rewritten", "data", "alternatives", "items", "result"):
            if key in response_data and isinstance(response_data[key], list):
                sentences_result = response_data[key]
                break
        else:
            # Fallback: dict of numbered items — sort numerically
            numeric_keys = sorted(
                (k for k in response_data if k != "error"),
                key=lambda k: int(k) if k.isdigit() else 0
            )
            for key in numeric_keys:
                item = response_data[key]
                if isinstance(item, dict):
                    sentences_result.append(item)
                elif isinstance(item, list):
                    sentences_result.extend(item)

    # Extract content from the result
    content_parts = []
    for item in sentences_result:
        if isinstance(item, dict):
            rewritten = item.get("rewritten", item.get("revised", item.get("original", "")))
            if rewritten:
                content_parts.append(rewritten)
        elif isinstance(item, str):
            if item:
                content_parts.append(item)
    
    content = "".join(content_parts)
    
    change_log = []
    for s in sentences_result:
        if isinstance(s, dict):
            change_log.append({
                "original": s.get("original", ""),
                "revised": s.get("rewritten", s.get("revised", "")),
                "reason": s.get("reason", "")
            })

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
    api_key = os.environ.get("AZURE_OPENAI_KEY")
    endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT")
    deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT")
    
    if not all([api_key, endpoint, deployment]):
        raise EnvironmentError(
            "Missing Azure OpenAI configuration. "
            "Please set AZURE_OPENAI_KEY, AZURE_OPENAI_ENDPOINT, and AZURE_OPENAI_DEPLOYMENT"
        )

    client = _make_client()

    analysis_result = _call_analysis(client, transcript)

    if analysis_result.get("transcript_too_short"):
        return analysis_result

    rewrite_result = _call_rewrite(client, transcript, speaker, analysis_result)

    analysis_result["rewritten_transcript"] = rewrite_result
    return analysis_result
