#!/usr/bin/env node
/**
 * MCP server for my-video-engine.
 *
 * Exposes the "topic/script -> scenario -> voiceover -> media import -> render"
 * pipeline as tools so a coding agent (Antigravity, Gemini CLI, Claude Code, ...)
 * can drive video production end to end. The Python engine (config_manager.py,
 * ai_generator.py, media_engine.py, render_engine.py, uploader.py) does the
 * actual work; these tools just shell out to it and manage video_data.json.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = path.resolve(__dirname, "..", "..", "my-video-engine");
const DATA_FILE = path.join(ENGINE_ROOT, "src", "data", "video_data.json");
const MEDIA_DIR = path.join(ENGINE_ROOT, "public", "media");
const AUDIO_DIR = path.join(ENGINE_ROOT, "public", "audio");
const OUTPUT_DIR = path.join(ENGINE_ROOT, "output");

// Agents (Antigravity, Gemini CLI, Claude Code) spawn this process directly —
// they never `source .venv/bin/activate` first — so default to the engine's
// own venv interpreter instead of whatever "python3" resolves to on PATH.
function resolvePython() {
  if (process.env.VIDEO_ENGINE_PYTHON) return process.env.VIDEO_ENGINE_PYTHON;
  const venvPython = path.join(ENGINE_ROOT, ".venv", "bin", "python3");
  return fsSync.existsSync(venvPython) ? venvPython : "python3";
}

const PYTHON = resolvePython();

const FPS = 30;
const PADDING_FRAMES = 15;
const WORDS_PER_SECOND = 2.3; // rough estimate before real TTS timings exist

async function readScenario() {
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

async function writeScenario(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function estimateDurationFrames(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const seconds = words / WORDS_PER_SECOND;
  return Math.round(seconds * FPS) + PADDING_FRAMES;
}

function textResult(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

function errorResult(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}

async function runPython(args, { maxBuffer = 20 * 1024 * 1024 } = {}) {
  return execFileAsync(PYTHON, args, { cwd: ENGINE_ROOT, maxBuffer });
}

const server = new McpServer({
  name: "video-engine-mcp",
  version: "2.0.0",
});

const sceneInputSchema = z.object({
  id: z.number().int().positive(),
  text: z.string().min(1),
  highlightWords: z.array(z.string()).optional(),
  imagePrompt: z
    .string()
    .describe(
      "Detailed prompt for the STILL image to generate for this scene (subject, style, framing, lighting). " +
        "No motion/video description — Ken Burns zoom is added automatically by render_video.",
    ),
});

server.registerTool(
  "generate_scenario_from_topic",
  {
    title: "Generate scenario from a topic (AI Brain)",
    description:
      "Runs the Gemini-based AI Brain (ai_generator.py) with its auto-scoring loop (Hook/Pacing/Loopability, " +
      "regenerates until score >= threshold) to turn a raw topic/idea into a full scene breakdown, and writes " +
      "it straight into video_data.json. Requires GEMINI_API_KEY in my-video-engine/.env. Use this instead of " +
      "save_scenario when you want the Python AI Brain to write the script; use save_scenario when you (the " +
      "calling agent) already wrote the scenes yourself.",
    inputSchema: {
      topic: z.string().min(1),
    },
  },
  async ({ topic }) => {
    try {
      const { stdout, stderr } = await runPython(["main.py", "script", topic]);
      const data = await readScenario();
      return textResult({ ok: true, scenesWritten: data.scenes.length, stdout, stderr });
    } catch (err) {
      return errorResult(`Scenario generation failed: ${err.message}\n${err.stderr ?? ""}`);
    }
  },
);

server.registerTool(
  "save_scenario",
  {
    title: "Save video scenario",
    description:
      "Write a scene breakdown you (the calling agent) already produced from a raw script into video_data.json. " +
      "Each scene needs an imagePrompt (still image only, no motion — Ken Burns zoom is added in render). " +
      "Duration is estimated from word count and corrected by generate_all_voiceovers once real audio exists.",
    inputSchema: {
      title: z.string(),
      voice: z.string().optional(),
      voiceRate: z.string().optional(),
      scenes: z.array(sceneInputSchema).min(1),
    },
  },
  async ({ title, voice, voiceRate, scenes }) => {
    const data = {
      meta: {
        title,
        ...(voice ? { voice } : {}),
        ...(voiceRate ? { voiceRate } : {}),
      },
      scenes: scenes.map((s) => ({
        id: s.id,
        text: s.text,
        audioFile: "",
        durationInFrames: estimateDurationFrames(s.text),
        ...(s.highlightWords ? { highlightWords: s.highlightWords } : {}),
        imagePrompt: s.imagePrompt,
        mediaStatus: "pending",
      })),
    };
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await writeScenario(data);
    return textResult({
      ok: true,
      scenesWritten: data.scenes.length,
      dataFile: DATA_FILE,
      next: "Call generate_all_voiceovers, then get_scenario_status to see which scenes still need media.",
    });
  },
);

server.registerTool(
  "get_scenario_status",
  {
    title: "Get scenario status",
    description:
      "Read video_data.json and report, per scene, whether audio/word-alignment and media exist yet, plus the " +
      "image prompt to hand to the user for generation in Gemini Ultra chat (Nano Banana).",
    inputSchema: {},
  },
  async () => {
    const data = await readScenario();
    const scenes = data.scenes.map((s) => ({
      id: s.id,
      text: s.text,
      hasAudio: Boolean(s.audioFile),
      hasWordTimestamps: Boolean(s.wordTimestamps),
      durationInFrames: s.durationInFrames,
      mediaStatus: s.mediaStatus ?? "pending",
      mediaFile: s.mediaFile ?? null,
      imagePrompt: s.imagePrompt ?? null,
    }));
    return textResult({ meta: data.meta, scenes });
  },
);

server.registerTool(
  "generate_all_voiceovers",
  {
    title: "Generate voiceovers + word alignment",
    description:
      "Runs media_engine.py: TTS (edge-tts) per scene, then local Whisper alignment for word-level timestamps " +
      "(more reliable than edge-tts's own WordBoundary events). Fills audioFile, wordTimestamps and corrects " +
      "durationInFrames from real speech length.",
    inputSchema: {},
  },
  async () => {
    try {
      const { stdout, stderr } = await runPython(["media_engine.py"], { maxBuffer: 20 * 1024 * 1024 });
      return textResult({ ok: true, stdout, stderr });
    } catch (err) {
      return errorResult(`Voiceover generation failed: ${err.message}\n${err.stderr ?? ""}`);
    }
  },
);

server.registerTool(
  "import_media",
  {
    title: "Import a generated image for a scene",
    description:
      "Copy a locally saved image (downloaded from Gemini Ultra chat after generating it from the scene's " +
      "imagePrompt) into the project and mark that scene's mediaStatus in video_data.json.",
    inputSchema: {
      sceneId: z.number().int().positive(),
      sourcePath: z.string().describe("Absolute path to the image file on disk, e.g. a downloaded file."),
    },
  },
  async ({ sceneId, sourcePath }) => {
    const resolvedSource = path.resolve(sourcePath);
    try {
      await fs.access(resolvedSource);
    } catch {
      return errorResult(`Source file not found: ${resolvedSource}`);
    }

    const data = await readScenario();
    const scene = data.scenes.find((s) => s.id === sceneId);
    if (!scene) {
      return errorResult(`No scene with id ${sceneId} in video_data.json`);
    }

    const ext = path.extname(resolvedSource) || ".png";
    const destName = `scene_${sceneId}${ext}`;
    const destPath = path.join(MEDIA_DIR, destName);

    await fs.mkdir(MEDIA_DIR, { recursive: true });
    await fs.copyFile(resolvedSource, destPath);

    scene.mediaStatus = "image";
    scene.mediaFile = `public/media/${destName}`;

    await writeScenario(data);

    return textResult({ ok: true, sceneId, mediaStatus: scene.mediaStatus, mediaFile: scene.mediaFile });
  },
);

server.registerTool(
  "render_video",
  {
    title: "Render final video",
    description:
      "Runs render_engine.py: composites every scene (static image + CSS Ken Burns zoom + word-synced karaoke " +
      "subtitles, captured via Playwright, encoded with FFmpeg) and crossfades them into output/final.mp4. Any " +
      "scene without imported media renders with a placeholder image instead of failing. Call after voiceovers " +
      "are generated.",
    inputSchema: {
      outputFile: z.string().default("output/final.mp4"),
    },
  },
  async ({ outputFile }) => {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    try {
      const { stdout, stderr } = await runPython(["render_engine.py", "--output", outputFile], {
        maxBuffer: 50 * 1024 * 1024,
      });
      const absOutput = path.resolve(ENGINE_ROOT, outputFile);
      const stat = await fs.stat(absOutput).catch(() => null);
      return textResult({
        ok: true,
        outputFile: absOutput,
        sizeMB: stat ? +(stat.size / 1024 / 1024).toFixed(1) : null,
        stdout,
        stderr,
      });
    } catch (err) {
      return errorResult(`Render failed: ${err.message}\n${err.stderr ?? ""}`);
    }
  },
);

server.registerTool(
  "upload_video",
  {
    title: "Upload video via an official platform API",
    description:
      "Runs uploader.py to publish a rendered video through YouTube's Data API v3 (OAuth, your own app) or " +
      "TikTok's Content Posting API (requires an approved developer app + TIKTOK_ACCESS_TOKEN). Does not use " +
      "anti-detect browsers or any bot-detection-evasion technique.",
    inputSchema: {
      platform: z.enum(["youtube", "tiktok"]),
      videoPath: z.string(),
      title: z.string(),
      description: z.string().optional(),
    },
  },
  async ({ platform, videoPath, title, description }) => {
    const args = ["main.py", "upload", platform, videoPath, "--title", title];
    if (description) args.push("--description", description);
    try {
      const { stdout, stderr } = await runPython(args);
      return textResult({ ok: true, stdout, stderr });
    } catch (err) {
      return errorResult(`Upload failed: ${err.message}\n${err.stderr ?? ""}`);
    }
  },
);

async function main() {
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  await fs.mkdir(AUDIO_DIR, { recursive: true });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal MCP server error:", err);
  process.exit(1);
});
