#!/usr/bin/env node
/**
 * Node.js TTS Generator for AI Video Engine.
 * Generates audio for each scene using @andresaya/edge-tts,
 * extracts word timestamps, calculates exact duration using music-metadata,
 * and updates video_data.json.
 */

const fs = require("fs");
const path = require("path");
const { EdgeTTS } = require("@andresaya/edge-tts");
const { parseFile } = require("music-metadata");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.join(PROJECT_ROOT, "src", "data", "video_data.json");
const AUDIO_DIR = path.join(PROJECT_ROOT, "public", "audio");

const FPS = 30;
const PADDING_FRAMES = 15; // 0.5s padding after each scene
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateSceneAudio(scene, voice, rate) {
  const sceneId = scene.id;
  const text = scene.text?.trim();

  if (!text) {
    console.log(`  [Scene ${sceneId}] ⚠ No text, skipping audio.`);
    scene.audioFile = "";
    return scene;
  }

  const audioFileName = `scene_${sceneId}.mp3`;
  const wordsFileName = `scene_${sceneId}_words.json`;
  const audioPath = path.join(AUDIO_DIR, audioFileName);
  const wordsPath = path.join(AUDIO_DIR, wordsFileName);

  console.log(`  [Scene ${sceneId}] Generating TTS (${text.length} chars)...`);

  let succeeded = false;
  let wordTimestamps = [];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const tts = new EdgeTTS();

      await tts.synthesize(text, voice, {
        rate: rate || "+0%",
        outputFormat: "audio-24khz-48kbitrate-mono-mp3",
      });
      const buffer = tts.toBuffer();
      if (!buffer || buffer.length === 0) {
        throw new Error("Empty audio buffer received");
      }

      fs.writeFileSync(audioPath, buffer);

      if (typeof tts.getWordBoundaries === "function") {
        const rawWords = tts.getWordBoundaries() || [];
        wordTimestamps = rawWords.map((w) => ({
          word: w.text || "",
          offset: (w.offset || 0) / 10000,
          duration: (w.duration || 0) / 10000,
        }));
        fs.writeFileSync(wordsPath, JSON.stringify(wordTimestamps, null, 2), "utf-8");
      }

      succeeded = true;
      break;
    } catch (err) {
      console.warn(`  [Scene ${sceneId}] ⚠ Attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY);
      }
    }
  }

  if (!succeeded) {
    console.error(`  [Scene ${sceneId}] ✗ Failed after ${MAX_RETRIES} attempts.`);
    return scene;
  }

  // Calculate duration using music-metadata
  try {
    const meta = await parseFile(audioPath);
    const durationSeconds = meta.format.duration || 3;
    const durationFrames = Math.round(durationSeconds * FPS) + PADDING_FRAMES;

    console.log(
      `  [Scene ${sceneId}] ✓ ${durationSeconds.toFixed(2)}s = ${durationFrames} frames (${wordTimestamps.length} words)`
    );

    scene.audioFile = `audio/${audioFileName}`;
    scene.durationInFrames = durationFrames;
  } catch (err) {
    console.warn(`  [Scene ${sceneId}] ⚠ Could not read duration from audio: ${err.message}`);
  }

  return scene;
}

async function main() {
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }

  console.log(`📂 Reading data from: ${DATA_FILE}`);
  const rawData = fs.readFileSync(DATA_FILE, "utf-8");
  const data = JSON.parse(rawData);

  const voice = data.meta?.voice || "vi-VN-NamMinhNeural";
  const rate = data.meta?.voiceRate || "+0%";

  console.log(`🎤 Voice: ${voice}, Rate: ${rate}`);
  console.log(`🎬 Processing ${data.scenes.length} scenes...\n`);

  for (let i = 0; i < data.scenes.length; i++) {
    data.scenes[i] = await generateSceneAudio(data.scenes[i], voice, rate);
    if (i < data.scenes.length - 1) {
      await sleep(1000);
    }
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n", "utf-8");

  const totalFrames = data.scenes.reduce((sum, s) => sum + (s.durationInFrames || 0), 0);
  const totalSeconds = (totalFrames / FPS).toFixed(1);

  console.log(`\n✅ Done! Total video duration: ${totalSeconds}s (${totalFrames} frames)`);
  console.log(`   Data saved to: ${DATA_FILE}`);
  console.log(`   Audio files in: ${AUDIO_DIR}`);
}

main().catch((err) => {
  console.error("\n❌ Fatal Error:", err);
  process.exit(1);
});
