import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Scene, ThemeColors, VideoMeta } from "../types";

interface SplitPsychSceneProps {
  scene: Scene;
  theme: ThemeColors;
  meta: VideoMeta;
}

/**
 * 3-Zone Split Psychology Scene ("Lành Tâm - Tâm Lý Học" format):
 * - Top Zone (25%): Channel badge ("LÀNH TÂM") + Fixed Golden Uppercase Topic Header
 * - Center Zone (40%): 16:9 Visual Viewport (plays generated video/image, or renders
 *   either a Pictogram black-on-white silhouette animation or Surreal Moody illustration)
 * - Bottom Zone (35%): Bilingual Centered Subtitles (Bold White Vietnamese + Grey English)
 */
export const SplitPsychScene: React.FC<SplitPsychSceneProps> = ({
  scene,
  meta,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [Math.max(10, durationInFrames - 8), durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const opacity = Math.min(fadeIn, fadeOut);

  const kenBurnsScale = interpolate(frame, [0, durationInFrames], [1, 1.1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const subPop = spring({
    frame,
    fps,
    config: { damping: 16, mass: 0.6, stiffness: 140 },
  });

  const channelName = (meta.channelName || "LÀNH TÂM").toUpperCase();
  const topicTitle = (meta.title || scene.title || "TÂM LÝ HỌC ĐỜI THƯỜNG").toUpperCase();
  const isPictogram =
    scene.visualMode === "pictogram" ||
    (scene.id % 2 === 1 && scene.visualMode !== "surreal");

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#06080d",
        fontFamily: "'Be Vietnam Pro', 'Plus Jakarta Sans', 'Montserrat', sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* TOP ZONE (25% height): Channel Badge + Golden Topic Title */}
      <div
        style={{
          height: "25%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          padding: "24px 36px 22px",
          background: "linear-gradient(180deg, #0b0f19 0%, #06080d 100%)",
        }}
      >
        {/* Channel Pill Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 18px",
            borderRadius: 999,
            background: "rgba(250, 204, 21, 0.08)",
            border: "1px solid rgba(250, 204, 21, 0.3)",
            marginBottom: 18,
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "linear-gradient(90deg, #facc15 50%, #1e293b 50%)",
              display: "inline-block",
              boxShadow: "0 0 8px rgba(250, 204, 21, 0.6)",
            }}
          />
          <span
            style={{
              color: "#fef08a",
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.14em",
            }}
          >
            {channelName}
          </span>
        </div>

        {/* Fixed Golden Topic Header */}
        <h1
          style={{
            margin: 0,
            color: "#facc15",
            fontSize: 38,
            fontWeight: 800,
            textAlign: "center",
            letterSpacing: "0.02em",
            lineHeight: 1.25,
            textShadow: "0 4px 24px rgba(250, 204, 21, 0.22)",
          }}
        >
          {topicTitle}
        </h1>
      </div>

      {/* CENTER ZONE (40% height): 16:9 Framed Visual Viewport */}
      <div
        style={{
          height: "40%",
          width: "100%",
          position: "relative",
          overflow: "hidden",
          backgroundColor: isPictogram ? "#ffffff" : "#12102e",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          opacity,
        }}
      >
        {scene.mediaStatus === "video" && scene.mediaFile ? (
          <OffthreadVideo
            src={staticFile(scene.mediaFile)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            volume={1}
          />
        ) : scene.mediaStatus === "image" && scene.mediaFile ? (
          <Img
            src={staticFile(scene.mediaFile)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${kenBurnsScale})`,
            }}
          />
        ) : isPictogram ? (
          <PictogramFallback frame={frame} sceneText={scene.text} />
        ) : (
          <SurrealPsychFallback frame={frame} />
        )}
      </div>

      {/* BOTTOM ZONE (35% height): Centered Bilingual Subtitles */}
      <div
        style={{
          height: "35%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "38px 44px 28px",
          background: "linear-gradient(180deg, #06080d 0%, #090d16 100%)",
          transform: `translateY(${interpolate(subPop, [0, 1], [12, 0])}px)`,
          opacity,
        }}
      >
        {/* Primary Vietnamese Subtitle */}
        <div
          style={{
            color: "#ffffff",
            fontSize: 33,
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.38,
            maxWidth: 620,
            marginBottom: 14,
            textShadow: "0 2px 14px rgba(0, 0, 0, 0.65)",
          }}
        >
          {scene.text}
        </div>

        {/* Secondary English Subtitle */}
        {scene.textEn && (
          <div
            style={{
              color: "#94a3b8",
              fontSize: 21,
              fontWeight: 500,
              textAlign: "center",
              lineHeight: 1.4,
              maxWidth: 580,
            }}
          >
            {scene.textEn}
          </div>
        )}
      </div>

      {/* Narration Audio */}
      {scene.audioFile && <Audio src={staticFile(scene.audioFile)} />}
    </AbsoluteFill>
  );
};

/**
 * Built-in Pictogram Silhouette Animation (Black male/female figures on stark white background)
 * matching 00:03 - 00:21 of the reference video.
 */
const PictogramFallback: React.FC<{ frame: number; sceneText: string }> = ({
  frame,
}) => {
  const wave = Math.sin(frame * 0.25) * 4;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#ffffff",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="420" height="320" viewBox="0 0 420 320">
        {/* Left Figure (Male Silhouette) */}
        <g transform={`translate(115, ${65 + wave * 0.4})`}>
          <circle cx="40" cy="30" r="24" fill="#111111" />
          <rect x="16" y="62" width="48" height="96" rx="14" fill="#111111" />
          <rect x="20" y="152" width="17" height="85" rx="8" fill="#111111" />
          <rect x="43" y="152" width="17" height="85" rx="8" fill="#111111" />
          {/* Gesturing Arm */}
          <rect
            x="56"
            y="72"
            width="54"
            height="14"
            rx="7"
            fill="#111111"
            transform={`rotate(${-15 + wave * 2} 56 72)`}
          />
        </g>

        {/* Speech / Argument Waves in Center */}
        <g transform="translate(198, 70)">
          <path
            d="M 0 18 Q 12 6 24 18"
            stroke="#111111"
            strokeWidth="4"
            fill="none"
            opacity={frame % 20 < 10 ? 1 : 0.35}
          />
          <path
            d="M -4 32 Q 12 20 28 32"
            stroke="#111111"
            strokeWidth="4"
            fill="none"
            opacity={frame % 20 >= 10 ? 1 : 0.35}
          />
          <text
            x="6"
            y="5"
            fontSize="26"
            fontWeight="900"
            fill="#111111"
            fontFamily="sans-serif"
          >
            ?!
          </text>
        </g>

        {/* Right Figure (Female Silhouette) */}
        <g transform={`translate(235, ${65 - wave * 0.4})`}>
          <circle cx="40" cy="30" r="23" fill="#111111" />
          <path d="M 18 64 L 62 64 L 76 158 L 4 158 Z" fill="#111111" />
          <rect x="22" y="154" width="15" height="82" rx="7" fill="#111111" />
          <rect x="43" y="154" width="15" height="82" rx="7" fill="#111111" />
          {/* Pointing Arm */}
          <rect
            x="-26"
            y="74"
            width="52"
            height="13"
            rx="6"
            fill="#111111"
            transform={`rotate(${12 - wave * 2} 26 74)`}
          />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/**
 * Built-in Surreal Psychology Illustration Animation (Moody Indigo/Violet + Glowing Crack/Thread)
 * matching 00:22 - 00:38 of the reference video.
 */
const SurrealPsychFallback: React.FC<{ frame: number }> = ({ frame }) => {
  const glow = 0.65 + Math.sin(frame * 0.12) * 0.25;
  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at 50% 40%, #241b5a 0%, #0b0920 100%)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="640" height="380" viewBox="0 0 640 380">
        {/* Glowing fracture / lightning thread between two minds */}
        <path
          d="M 320 20 L 310 110 L 334 175 L 308 260 L 325 360"
          stroke="#f43f5e"
          strokeWidth="4"
          fill="none"
          opacity={glow}
        />
        {/* Left Silhouette */}
        <g transform="translate(175, 110)">
          <circle cx="45" cy="36" r="26" fill="#312e81" stroke="#38bdf8" strokeWidth="2" />
          <path d="M 15 70 Q 45 65 75 70 L 85 210 L 5 210 Z" fill="#1e1b4b" stroke="#38bdf8" strokeWidth="1.5" />
        </g>
        {/* Right Silhouette */}
        <g transform="translate(375, 110)">
          <circle cx="45" cy="36" r="26" fill="#312e81" stroke="#c084fc" strokeWidth="2" />
          <path d="M 15 70 Q 45 65 75 70 L 85 210 L 5 210 Z" fill="#1e1b4b" stroke="#c084fc" strokeWidth="1.5" />
        </g>
      </svg>
    </AbsoluteFill>
  );
};
