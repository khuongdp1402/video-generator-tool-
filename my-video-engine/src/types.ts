// ====================================================================
// Type definitions for the AI Video Engine data schema
// ====================================================================

export type ThemeName = "dark-cyan" | "dark-purple" | "warm-orange" | "neon-green";

export interface VideoMeta {
  title: string;
  theme: ThemeName;
  bgMusic: string;
  musicVolume: number;
  voice?: string;
  voiceRate?: string;
  /** "16:9" (1280x720) or "9:16" (720x1280). Defaults to "16:9" if absent. */
  aspectRatio?: "16:9" | "9:16";
}

export type SceneType = "headline" | "bullet_points" | "tip" | "outro" | "dialogue" | "story" | "whiteboard" | "media" | "lesson";

export interface DrawingItem {
  type: string;
  label: string;
}

/** How the visual for a "media" scene is currently fulfilled. */
export type MediaStatus = "pending" | "image" | "video";

export interface Scene {
  id: number;
  type: SceneType;
  text: string;
  audioFile: string;
  durationInFrames: number;
  highlightWords?: string[];
  bullets?: string[];
  icon?: string;
  characterId?: string;
  expression?: string;
  // Story scene fields
  background?: string;
  characterPosition?: "left" | "right" | "center";
  // Whiteboard scene fields
  title?: string;
  drawings?: DrawingItem[];
  // Media scene fields (AI-generated image/video per scene)
  /** Prompt describing the still image to generate for this scene. */
  imagePrompt?: string;
  /** Prompt describing how the still image should be animated into a video. */
  videoPrompt?: string;
  /** Whether the scene currently has a generated image, a generated video, or nothing yet. */
  mediaStatus?: MediaStatus;
  /** Path (relative to public/) of the imported media file, once generated. */
  mediaFile?: string;
}

export interface VideoData {
  meta: VideoMeta;
  scenes: Scene[];
}

export interface WordTimestamp {
  word: string;
  offset: number; // in milliseconds
  duration: number; // in milliseconds
}

export interface ThemeColors {
  bg1: string;
  bg2: string;
  accent: string;
  accentGlow: string;
  text: string;
  textSecondary: string;
  cardBg: string;
  cardBorder: string;
}

export const THEMES: Record<ThemeName, ThemeColors> = {
  "dark-cyan": {
    bg1: "#0a0f1a",
    bg2: "#0d1b2a",
    accent: "#00d4ff",
    accentGlow: "rgba(0, 212, 255, 0.4)",
    text: "#ffffff",
    textSecondary: "#8899aa",
    cardBg: "rgba(13, 27, 42, 0.85)",
    cardBorder: "rgba(0, 212, 255, 0.3)",
  },
  "dark-purple": {
    bg1: "#0a0015",
    bg2: "#1a0030",
    accent: "#bf5af2",
    accentGlow: "rgba(191, 90, 242, 0.4)",
    text: "#ffffff",
    textSecondary: "#aa88cc",
    cardBg: "rgba(26, 0, 48, 0.85)",
    cardBorder: "rgba(191, 90, 242, 0.3)",
  },
  "warm-orange": {
    bg1: "#1a0a00",
    bg2: "#2a1500",
    accent: "#ff6b35",
    accentGlow: "rgba(255, 107, 53, 0.4)",
    text: "#ffffff",
    textSecondary: "#cc9966",
    cardBg: "rgba(42, 21, 0, 0.85)",
    cardBorder: "rgba(255, 107, 53, 0.3)",
  },
  "neon-green": {
    bg1: "#000a0a",
    bg2: "#001a15",
    accent: "#39ff14",
    accentGlow: "rgba(57, 255, 20, 0.4)",
    text: "#ffffff",
    textSecondary: "#66cc99",
    cardBg: "rgba(0, 26, 21, 0.85)",
    cardBorder: "rgba(57, 255, 20, 0.3)",
  },
};
