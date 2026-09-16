import React from "react";
import {
  AbsoluteFill,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { Background } from "../components/Background";
import { Subtitle } from "../components/Subtitle";
import { SceneTransition } from "../components/SceneTransition";
import { Scene, ThemeColors } from "../types";

interface HeadlineSceneProps {
  scene: Scene;
  theme: ThemeColors;
}

/**
 * Headline scene template - attention-grabbing opening scene.
 * Features a large animated icon, bouncy headline text,
 * and karaoke-style subtitle.
 */
export const HeadlineScene: React.FC<HeadlineSceneProps> = ({
  scene,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Icon entrance - pop-in with overshoot
  const iconScale = spring({
    frame,
    fps,
    config: { damping: 8, mass: 0.5, stiffness: 200 },
  });

  // Icon pulse glow
  const iconGlow = interpolate(frame % 60, [0, 30, 60], [0.4, 0.8, 0.4]);

  // Title line - decorative accent
  const lineWidth = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 15, mass: 0.5, stiffness: 150 },
  });

  return (
    <SceneTransition type="zoom" durationInFrames={scene.durationInFrames}>
      <AbsoluteFill>
        <Background theme={theme} />

        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "60px 40px",
            gap: 50,
          }}
        >
          {/* Animated icon */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 30,
              background: `linear-gradient(135deg, ${theme.accent}22, ${theme.accent}44)`,
              border: `2px solid ${theme.accent}66`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${iconScale})`,
              boxShadow: `0 0 ${30 + iconGlow * 20}px ${theme.accentGlow}`,
            }}
          >
            <svg
              width="60"
              height="60"
              viewBox="0 0 24 24"
              fill="none"
              stroke={theme.accent}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Alert/notification icon */}
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          {/* Accent line */}
          <div
            style={{
              width: `${lineWidth * 200}px`,
              height: 3,
              background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
              borderRadius: 2,
            }}
          />

          {/* Karaoke subtitle */}
          <Subtitle
            text={scene.text}
            highlightWords={scene.highlightWords}
            theme={theme}
            startDelay={15}
          />
        </AbsoluteFill>

        {/* Audio */}
        {scene.audioFile && <Audio src={staticFile(scene.audioFile)} />}
      </AbsoluteFill>
    </SceneTransition>
  );
};
