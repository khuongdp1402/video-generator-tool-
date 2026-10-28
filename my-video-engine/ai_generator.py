"""
Module 2: AI Brain.
Turns a raw topic/idea into a structured, scene-by-scene video script using
AgentGW (`https://agentgw.cloud/v1/chat/completions`, Claude Opus 4.8 / GPT-5.5)
with fallback to Gemini API. Supports US (en-US), Japan (ja-JP), and Vietnam (vi-VN)
markets. Runs an auto-scoring loop: generate -> self-critique on Hook/Pacing/Loopability
-> regenerate with feedback if below threshold.
"""

from __future__ import annotations

import json
import re

import requests

from config_manager import get_logger, load_config

logger = get_logger(__name__)

MARKET_INSTRUCTIONS = {
    "US": {
        "name": "United States (YouTube US - Native American English)",
        "language_rule": (
            "Write all narration (`hook`, `body`, `scenes[].text`, `youtubeTitle`, `youtubeDescription`) "
            "in punchy, natural, native American English. Use high-retention storytelling hooks, short active "
            "sentences, zero translation-ese, and a conversational authority tone (like Kurzgesagt / Ali Abdaal / Mark Manson)."
        ),
    },
    "JP": {
        "name": "Japan (YouTube Japan - Natural Spoken Japanese)",
        "language_rule": (
            "Write all narration (`hook`, `body`, `scenes[].text`, `youtubeTitle`, `youtubeDescription`) "
            "in natural spoken Japanese for YouTube (丁寧語 です・ます調 mixed with impactful rhetorical hooks). "
            "Avoid stiff machine-translated phrasing. Keep sentences rhythmic and concise for Japanese TTS. "
            "`highlightWords` must be short 2-6 character Japanese keywords (Kanji/Katakana) that appear in `text`."
        ),
    },
    "VI": {
        "name": "Vietnam (YouTube Vietnam - Natural Spoken Vietnamese)",
        "language_rule": (
            "Write all narration (`hook`, `body`, `scenes[].text`, `youtubeTitle`, `youtubeDescription`) "
            "in natural spoken Vietnamese; avoid literal translation-ese."
        ),
    },
}


def _build_script_system_instruction(market: str = "US", num_scenes: int = 7) -> str:
    m_code = (market or "US").strip().upper()
    m_info = MARKET_INSTRUCTIONS.get(m_code, MARKET_INSTRUCTIONS["US"])
    return f"""You are a viral YouTube scriptwriter and creative director targeting the {m_info["name"]} market.
Given a topic (in any language, including Vietnamese, English, or Japanese), localize and craft a high-retention script broken into {num_scenes} scenes for a video that uses AI-generated visuals plus voiceover and word-highlighted subtitles.

Output strict JSON matching this exact shape, nothing else (no markdown fences):
{{
  "market": "{m_code}",
  "youtubeTitle": "<high-CTR native title for {m_code} YouTube>",
  "youtubeDescription": "<2-3 sentence SEO description with hashtags in the target language>",
  "youtubeTags": ["<tag1>", "<tag2>", "<tag3>", "<tag4>", "<tag5>"],
  "hook": "<one-sentence scroll-stopping hook used as scene 1>",
  "body": "<the rest of the narration, {max(4, num_scenes - 1)}-{num_scenes + 1} sentences>",
  "scenes": [
    {{
      "text": "<one sentence of narration in the target market language>",
      "imagePrompt": "<detailed English visual prompt: subject, cinematic style, framing, lighting, composition, no text in image>",
      "highlightWords": ["word1", "word2"]
    }}
  ]
}}

Rules:
- {m_info["language_rule"]}
- `scenes[0].text` must equal (or closely match) `hook`; the last scene must include a subtle call-to-action or loopable philosophical question.
- `imagePrompt` MUST always be written in English and describe a rich visual scene with no text/letters rendered inside the image.
"""


SCORING_SYSTEM_INSTRUCTION = """You are a ruthless international YouTube retention editor. Score the given script from 0-100 on:
- Hook (does the first line immediately open a curiosity gap and stop the scroll?)
- Native Fluency & Cultural Fit (does it read like a top 1% native creator in the target market rather than a translation?)
- Pacing & Loopability (does each scene advance tension cleanly and connect the ending back to the core premise?)

Output strict JSON only (no markdown fences): {"score": <0-100 integer>, "feedback": "<one paragraph of concrete, actionable feedback>"}
"""


def _extract_json(raw_text: str) -> dict:
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw_text.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            return json.loads(match.group(0))
        raise


def _call_llm_json(cfg, system_instruction: str, user_prompt: str) -> dict:
    import subprocess

    agentgw_key = cfg.env.get("agentgw_api_key", "")
    if agentgw_key:
        base_url = cfg.env.get("agentgw_base_url", "https://agentgw.cloud/v1").rstrip("/")
        primary_model = cfg.env.get("agentgw_model", "agentgw-opus-4-8")
        models_to_try = [primary_model, "agentgw-sonnet-4-6", "agentgw-gpt-5.5-xhigh"]
        last_err = None
        for model in models_to_try:
            try:
                payload = json.dumps(
                    {
                        "model": model,
                        "temperature": 0.4,
                        "max_tokens": 4096,
                        "messages": [
                            {"role": "system", "content": system_instruction},
                            {"role": "user", "content": user_prompt},
                        ],
                    },
                    ensure_ascii=False,
                )
                proc = subprocess.run(
                    [
                        "curl",
                        "-sS",
                        "--max-time",
                        "75",
                        "-X",
                        "POST",
                        f"{base_url}/chat/completions",
                        "-H",
                        "Content-Type: application/json",
                        "-H",
                        f"Authorization: Bearer {agentgw_key}",
                        "-d",
                        payload,
                    ],
                    capture_output=True,
                    text=True,
                    check=True,
                )
                data = json.loads(proc.stdout)
                if "error" in data:
                    raise RuntimeError(str(data["error"]))
                content = data["choices"][0]["message"]["content"]
                return _extract_json(content)
            except Exception as exc:
                logger.warning("AgentGW model %s failed (%s), trying next model...", model, exc)
                last_err = exc
        raise last_err

    # Fallback to Gemini if AGENTGW_API_KEY is not set
    import google.generativeai as genai

    api_key = cfg.env["gemini_api_key"]
    if not api_key:
        raise RuntimeError(
            "Neither AGENTGW_API_KEY nor GEMINI_API_KEY is set. Check .env configuration."
        )
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        cfg.get("ai", "fallback_model", default="gemini-1.5-pro"),
        system_instruction=system_instruction,
        generation_config={"response_mime_type": "application/json"},
    )
    response = model.generate_content(user_prompt)
    return _extract_json(response.text)


def generate_scenario(topic: str, market: str = "US") -> dict:
    """
    Run the generate -> score -> regenerate loop and return the best script
    as a dict shaped like {"market", "youtubeTitle", "youtubeDescription", "youtubeTags", "hook", "body", "scenes": [...]}.
    """
    cfg = load_config()
    market_code = (market or "US").strip().upper()
    min_score = cfg.get("ai", "min_score", default=85)
    max_attempts = cfg.get("ai", "max_attempts", default=3)
    num_scenes = cfg.get("ai", "num_scenes", default=7)

    script_sys = _build_script_system_instruction(market=market_code, num_scenes=num_scenes)

    best_script, best_score, feedback = None, -1, None

    for attempt in range(1, max_attempts + 1):
        logger.info(
            "Generating script for topic=%r market=%s (attempt %d/%d)",
            topic,
            market_code,
            attempt,
            max_attempts,
        )
        prompt = f"Target Market: {market_code}\nTopic / Source Idea: {topic}"
        if feedback:
            prompt += f"\n\nThe previous draft scored below our bar. Revise it using this feedback:\n{feedback}"

        script = _call_llm_json(cfg, script_sys, prompt)
        result = _call_llm_json(cfg, SCORING_SYSTEM_INSTRUCTION, json.dumps(script, ensure_ascii=False))
        score, feedback = int(result.get("score", 85)), result.get("feedback", "")
        logger.info("Attempt %d scored %d/100: %s", attempt, score, feedback)

        if score > best_score:
            best_script, best_score = script, score

        if score >= min_score:
            break

    logger.info("Final script score (%s): %d/100", market_code, best_score)
    return best_script


if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="Generate a YouTube scenario via AgentGW")
    parser.add_argument("topic", help="Topic or rough idea (any language)")
    parser.add_argument("--market", default="US", choices=["US", "JP", "VI"], help="Target YouTube market")
    args = parser.parse_args()

    result = generate_scenario(args.topic, market=args.market)
    print(json.dumps(result, ensure_ascii=False, indent=2))

