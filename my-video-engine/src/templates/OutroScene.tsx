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
import { SceneTransition } from "../components/SceneTransition";
import { Scene, ThemeColors } from "../types";

interface OutroSceneProps {
  scene: Scene;
  theme: ThemeColors;
}

/**
 * Outro scene template - call to action ending.
 * Features a large CTA text with animated accent elements.
 */
export const OutroScene: React.FC<OutroSceneProps> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Main text spring
  const textSpring = spring({
    frame,
    fps,
    config: { damping: 10, mass: 0.5, stiffness: 180 },
  });

  // CTA button pulse
  const btnPulse = interpolate(frame % 40, [0, 20, 40], [1, 1.06, 1]);

  // Decorative rings
  const ring1 = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 12, mass: 0.8, stiffness: 100 },
  });

  const ring2 = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 12, mass: 0.8, stiffness: 100 },
  });

  // Rotation for rings
  const rotation = interpolate(frame, [0, 300], [0, 360]);

  return (
    <SceneTransition type="fade" durationInFrames={scene.durationInFrames}>
      <AbsoluteFill>
        <Background theme={theme} />

        {/* Decorative rotating rings */}
        <AbsoluteFill
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 500,
              height: 500,
              borderRadius: "50%",
              border: `2px solid ${theme.accent}22`,
              transform: `scale(${ring1}) rotate(${rotation}deg)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 650,
              height: 650,
              borderRadius: "50%",
              border: `1px solid ${theme.accent}15`,
              transform: `scale(${ring2}) rotate(${-rotation * 0.5}deg)`,
            }}
          />
        </AbsoluteFill>

        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "60px 50px",
            gap: 50,
          }}
        >
          {/* Rocket icon */}
          <div
            style={{
              transform: `scale(${textSpring}) translateY(${interpolate(frame % 60, [0, 30, 60], [0, -8, 0])}px)`,
            }}
          >
            <svg
              width="80"
              height="80"
              viewBox="0 0 24 24"
              fill="none"
              stroke={theme.accent}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
              <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
              <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
              <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
            </svg>
          </div>

          {/* CTA text */}
          <div
            style={{
              transform: `scale(${textSpring})`,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontFamily: "'Be Vietnam Pro', 'Montserrat', sans-serif",
                fontWeight: 800,
                color: theme.text,
                lineHeight: 1.4,
                textShadow: `0 0 30px ${theme.accentGlow}`,
              }}
            >
              {scene.text}
            </div>
          </div>

          {/* Animated CTA button */}
          <div
            style={{
              transform: `scale(${textSpring * btnPulse})`,
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`,
              borderRadius: 60,
              padding: "18px 50px",
              boxShadow: `0 0 30px ${theme.accentGlow}, 0 4px 15px rgba(0,0,0,0.3)`,
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontFamily: "'Be Vietnam Pro', sans-serif",
                fontWeight: 700,
                color: theme.bg1,
                letterSpacing: "1px",
              }}
            >
              FOLLOW NGAY ▶
            </span>
          </div>
        </AbsoluteFill>

        {/* Audio */}
        {scene.audioFile && <Audio src={staticFile(scene.audioFile)} />}
      </AbsoluteFill>
    </SceneTransition>
  );
};
