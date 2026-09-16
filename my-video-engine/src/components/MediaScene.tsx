import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Scene, ThemeColors } from "../types";
import { Subtitle } from "./Subtitle";

interface MediaSceneProps {
  scene: Scene;
  theme: ThemeColors;
}

/**
 * Generic scene for AI-generated visuals: plays a generated video clip if one
 * exists, falls back to a Ken Burns pan/zoom over a generated still image,
 * and falls back further to a placeholder card while the media is still
 * pending (so the pipeline stays renderable at every stage).
 */
export const MediaScene: React.FC<MediaSceneProps> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const opacity = Math.min(fadeIn, fadeOut);

  // Slow continuous zoom for the Ken Burns effect on still images.
  const kenBurnsScale = interpolate(frame, [0, durationInFrames], [1, 1.12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg1 }}>
      <AbsoluteFill style={{ opacity }}>
        {scene.mediaStatus === "video" && scene.mediaFile ? (
          <OffthreadVideo
            src={staticFile(scene.mediaFile)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
        ) : (
          <AbsoluteFill
            style={{
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(160deg, ${theme.bg1}, ${theme.bg2})`,
              padding: 60,
            }}
          >
            <p
              style={{
                color: theme.textSecondary,
                fontSize: 28,
                textAlign: "center",
                fontFamily: "'Be Vietnam Pro', 'Montserrat', sans-serif",
              }}
            >
              [Đang chờ media cho scene {scene.id}]
              {scene.imagePrompt ? `\n\nPrompt: ${scene.imagePrompt}` : ""}
            </p>
          </AbsoluteFill>
        )}

        {/* Darken bottom for subtitle legibility */}
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 35%)",
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          paddingBottom: 140,
        }}
      >
        <Subtitle text={scene.text} highlightWords={scene.highlightWords} theme={theme} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
