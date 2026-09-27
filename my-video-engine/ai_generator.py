"""
Module 2: AI Brain.
Turns a raw topic/idea into a structured, scene-by-scene video script using
the official Gemini API (no browser scraping). Runs an auto-scoring loop:
generate -> self-critique on Hook/Pacing/Loopability -> regenerate with the
critique as feedback if the score is below the configured threshold.
"""

from __future__ import annotations

import json

import google.generativeai as genai

from config_manager import get_logger, load_config

logger = get_logger(__name__)

SCRIPT_SYSTEM_INSTRUCTION = """You are a viral short-form video scriptwriter for a "philosophical book summary" \
channel in Vietnamese. Given a topic (often a book or an idea), produce a script broken into scenes for a \
vertical video that uses static AI-generated images animated with a Ken Burns effect (no motion video, no \
characters speaking on screen) plus a voiceover and word-highlighted subtitles.

Output strict JSON matching this shape, nothing else:
{
  "hook": "<one-sentence hook used as scene 1>",
  "body": "<the rest of the narration, 5-8 sentences>",
  "scenes": [
    {"text": "<one sentence of narration>", "imagePrompt": "<detailed still-image prompt: subject, style, framing, lighting, vertical 9:16 composition>", "highlightWords": ["word1", "word2"]}
  ]
}

Rules:
- scenes[0].text must equal (or closely match) the hook; the last scene must include a short call-to-action to follow.
- imagePrompt must describe a STILL image only (no camera motion, no video description) — motion is added later in code.
- Keep narration natural, spoken Vietnamese; avoid literal translation-ese.
"""

SCORING_SYSTEM_INSTRUCTION = """You are a ruthless short-form video editor. Score the given script from 0-100 on:
- Hook (does the first line stop the scroll?)
- Pacing (does each sentence carry the story forward without dragging?)
- Loopability (does the ending connect back to the beginning so it can loop?)

Output strict JSON: {"score": <0-100 integer>, "feedback": "<one paragraph of concrete, actionable feedback>"}
"""


def _get_model(cfg, system_instruction: str):
    api_key = cfg.env["gemini_api_key"]
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Copy .env.example to .env and fill it in "
            "(get a key at https://aistudio.google.com/apikey)."
        )
    genai.configure(api_key=api_key)
    return genai.GenerativeModel(
        cfg.get("ai", "model", default="gemini-1.5-pro"),
        system_instruction=system_instruction,
        generation_config={"response_mime_type": "application/json"},
    )


def _generate_script(model, topic: str, feedback: str | None = None) -> dict:
    prompt = f"Topic: {topic}"
    if feedback:
        prompt += f"\n\nThe previous draft scored below our bar. Revise it using this feedback:\n{feedback}"
    response = model.generate_content(prompt)
    return json.loads(response.text)


def _score_script(model, script: dict) -> dict:
    response = model.generate_content(json.dumps(script, ensure_ascii=False))
    return json.loads(response.text)


def generate_scenario(topic: str) -> dict:
    """
    Run the generate -> score -> regenerate loop and return the best script
    as a dict shaped like {"hook", "body", "scenes": [...]}.
    """
    cfg = load_config()
    min_score = cfg.get("ai", "min_score", default=85)
    max_attempts = cfg.get("ai", "max_attempts", default=3)

    script_model = _get_model(cfg, SCRIPT_SYSTEM_INSTRUCTION)
    scoring_model = _get_model(cfg, SCORING_SYSTEM_INSTRUCTION)

    best_script, best_score, feedback = None, -1, None

    for attempt in range(1, max_attempts + 1):
        logger.info("Generating script for topic=%r (attempt %d/%d)", topic, attempt, max_attempts)
        script = _generate_script(script_model, topic, feedback)
        result = _score_script(scoring_model, script)
        score, feedback = result["score"], result.get("feedback", "")
        logger.info("Attempt %d scored %d/100: %s", attempt, score, feedback)

        if score > best_score:
            best_script, best_score = script, score

        if score >= min_score:
            break

    logger.info("Final script score: %d/100", best_score)
    return best_script


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python3 ai_generator.py \"<topic>\"", file=sys.stderr)
        sys.exit(1)

    result = generate_scenario(sys.argv[1])
    print(json.dumps(result, ensure_ascii=False, indent=2))
