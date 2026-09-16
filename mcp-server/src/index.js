#!/usr/bin/env node
/**
 * MCP server for my-video-engine.
 *
 * Exposes the "script -> scenario -> voiceover -> media import -> render"
 * pipeline as tools so a coding agent (Gemini CLI, Claude Code, ...) can
 * drive video production end to end. The agent itself is expected to do the
 * creative writing (breaking a script into scenes, writing image/video
 * prompts) — these tools only handle the deterministic, local-filesystem
 * and subprocess parts: persisting the scenario, running TTS, importing
 * media files the user generated in Gemini Ultra chat, and rendering.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
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

const server = new McpServer({
  name: "video-engine-mcp",
  version: "1.0.0",
});

const sceneInputSchema = z.object({
  id: z.number().int().positive(),
  type: z
    .enum([
      "media",
      "headline",
      "bullet_points",
      "tip",
      "outro",
      "dialogue",
      "story",
      "whiteboard",
    ])
    .default("media"),
  text: z.string().min(1),
  highlightWords: z.array(z.string()).optional(),
  imagePrompt: z
    .string()
    .optional()
    .describe(
      "Detailed prompt for the still image to generate for this scene (subject, style, framing, lighting).",
    ),
  videoPrompt: z
    .string()
    .optional()
    .describe(
      "Prompt describing how the still image should animate into a short video clip (camera move, motion in the scene).",
    ),
});

server.registerTool(
  "save_scenario",
  {
    title: "Save video scenario",
    description:
      "Write the full scene breakdown (already produced by you from the raw script) into video_data.json. " +
      "Call this once you have split the script into scenes and written an imagePrompt/videoPrompt for each. " +
      "Duration is estimated from word count and will be corrected by generate_all_voiceovers once real audio exists.",
    inputSchema: {
      title: z.string(),
      theme: z
        .enum(["dark-cyan", "dark-purple", "warm-orange", "neon-green"])
        .default("dark-cyan"),
      bgMusic: z.string().default(""),
      musicVolume: z.number().min(0).max(1).default(0.1),
      voice: z.string().optional(),
      voiceRate: z.string().optional(),
      scenes: z.array(sceneInputSchema).min(1),
    },
  },
  async ({ title, theme, bgMusic, musicVolume, voice, voiceRate, scenes }) => {
    const data = {
      meta: {
        title,
        theme,
        bgMusic,
        musicVolume,
        ...(voice ? { voice } : {}),
        ...(voiceRate ? { voiceRate } : {}),
      },
      scenes: scenes.map((s) => ({
        id: s.id,
        type: s.type,
        text: s.text,
        audioFile: "",
        durationInFrames: estimateDurationFrames(s.text),
        ...(s.highlightWords ? { highlightWords: s.highlightWords } : {}),
        ...(s.imagePrompt ? { imagePrompt: s.imagePrompt } : {}),
        ...(s.videoPrompt ? { videoPrompt: s.videoPrompt } : {}),
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
      "Read video_data.json and report, per scene, whether audio and media exist yet, plus the image/video " +
      "prompts to hand to the user for generation in Gemini Ultra chat (Nano Banana / Veo).",
    inputSchema: {},
  },
  async () => {
    const data = await readScenario();
    const scenes = data.scenes.map((s) => ({
      id: s.id,
      type: s.type,
      text: s.text,
      hasAudio: Boolean(s.audioFile),
      durationInFrames: s.durationInFrames,
      mediaStatus: s.mediaStatus ?? (s.type === "media" ? "pending" : "n/a"),
      mediaFile: s.mediaFile ?? null,
      imagePrompt: s.imagePrompt ?? null,
      videoPrompt: s.videoPrompt ?? null,
    }));
    return textResult({ meta: data.meta, scenes });
  },
);

server.registerTool(
  "generate_all_voiceovers",
  {
    title: "Generate voiceovers",
    description:
      "Run the TTS pipeline (scripts/tts_generator.py, edge-tts) over every scene in video_data.json. " +
      "Fills audioFile and corrects durationInFrames from real speech length. Requires python3 with edge-tts " +
      "and mutagen installed.",
    inputSchema: {},
  },
  async () => {
    try {
      const { stdout, stderr } = await execFileAsync(
        "python3",
        ["scripts/tts_generator.py"],
        { cwd: ENGINE_ROOT, maxBuffer: 20 * 1024 * 1024 },
      );
      return textResult({ ok: true, stdout, stderr });
    } catch (err) {
      return errorResult(
        `TTS generation failed: ${err.message}\n${err.stdout ?? ""}\n${err.stderr ?? ""}`,
      );
    }
  },
);

server.registerTool(
  "import_media",
  {
    title: "Import generated media for a scene",
    description:
      "Copy a locally saved image or video (downloaded from Gemini Ultra chat after generating it from the " +
      "scene's imagePrompt/videoPrompt) into the project and mark that scene's mediaStatus in video_data.json.",
    inputSchema: {
      sceneId: z.number().int().positive(),
      sourcePath: z
        .string()
        .describe("Absolute path to the image/video file on disk, e.g. a downloaded file."),
      mediaType: z.enum(["image", "video"]),
    },
  },
  async ({ sceneId, sourcePath, mediaType }) => {
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

    const ext = path.extname(resolvedSource) || (mediaType === "video" ? ".mp4" : ".png");
    const destName = `scene_${sceneId}${ext}`;
    const destPath = path.join(MEDIA_DIR, destName);

    await fs.mkdir(MEDIA_DIR, { recursive: true });
    await fs.copyFile(resolvedSource, destPath);

    scene.type = "media";
    scene.mediaStatus = mediaType;
    scene.mediaFile = `media/${destName}`;

    await writeScenario(data);

    return textResult({
      ok: true,
      sceneId,
      mediaStatus: scene.mediaStatus,
      mediaFile: scene.mediaFile,
    });
  },
);

server.registerTool(
  "render_video",
  {
    title: "Render final video",
    description:
      "Run `remotion render` to composite all scenes (audio + media + subtitles) into output/final.mp4. " +
      "Call this after voiceovers are generated and every scene's media has been imported.",
    inputSchema: {
      outputFile: z.string().default("output/final.mp4"),
    },
  },
  async ({ outputFile }) => {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    try {
      const { stdout, stderr } = await execFileAsync(
        "npx",
        ["remotion", "render", "src/index.ts", "VideoComposition", outputFile],
        { cwd: ENGINE_ROOT, maxBuffer: 50 * 1024 * 1024 },
      );
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
      return errorResult(
        `Render failed: ${err.message}\n${err.stdout ?? ""}\n${err.stderr ?? ""}`,
      );
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
