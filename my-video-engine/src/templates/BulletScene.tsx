import React from "react";
import {
  AbsoluteFill,
  Audio,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
} from "remotion";
import { Background } from "../components/Background";
import { Card } from "../components/Card";
import { Subtitle } from "../components/Subtitle";
import { BulletList } from "../components/BulletList";
import { SceneTransition } from "../components/SceneTransition";
import { Scene, ThemeColors } from "../types";

interface BulletSceneProps {
  scene: Scene;
  theme: ThemeColors;
}

/**
 * Bullet points scene template.
 * Shows a narrated text at top, with bullet points in a card below.
 */
export const BulletScene: React.FC<BulletSceneProps> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Section label animation
  const labelScale = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.4, stiffness: 200 },
  });

  return (
    <SceneTransition type="slide-up" durationInFrames={scene.durationInFrames}>
      <AbsoluteFill>
        <Background theme={theme} />

        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            padding: "80px 50px",
            gap: 40,
          }}
        >
          {/* Section label pill */}
          <div
            style={{
              transform: `scale(${labelScale})`,
              background: `${theme.accent}18`,
              border: `1px solid ${theme.accent}44`,
              borderRadius: 50,
              padding: "10px 28px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: theme.accent,
                boxShadow: `0 0 8px ${theme.accentGlow}`,
              }}
            />
            <span
              style={{
                fontSize: 22,
                fontFamily: "'Be Vietnam Pro', sans-serif",
                fontWeight: 600,
                color: theme.accent,
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              Mẹo hay
            </span>
          </div>

          {/* Narration text with karaoke */}
          <Subtitle
            text={scene.text}
            highlightWords={scene.highlightWords}
            theme={theme}
            startDelay={10}
          />

          {/* Bullet points card */}
          <Card theme={theme} delay={15} direction="bottom">
            <BulletList
              bullets={scene.bullets || []}
              theme={theme}
              startDelay={30}
            />
          </Card>
        </AbsoluteFill>

        {/* Audio */}
        {scene.audioFile && <Audio src={staticFile(scene.audioFile)} />}
      </AbsoluteFill>
    </SceneTransition>
  );
};
