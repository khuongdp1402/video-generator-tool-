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
import { Character } from "../components/Character";
import { SceneTransition } from "../components/SceneTransition";
import { ClassroomScene } from "../components/scenes/ClassroomScene";
import { OutdoorScene } from "../components/scenes/OutdoorScene";
import { Scene, ThemeColors } from "../types";

interface StorySceneProps {
  scene: Scene;
  theme: ThemeColors;
}

const BACKGROUNDS: Record<string, React.FC> = {
  classroom: ClassroomScene,
  outdoor: OutdoorScene,
};

/**
 * Story scene template - character placed IN a scene background
 * with natural speech bubble positioning.
 */
export const StoryScene: React.FC<StorySceneProps> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const characterId = scene.characterId || "minh";
  const expression = (scene.expression as any) || "happy";
  const position = scene.characterPosition || "center";
  const bgKey = scene.background || "outdoor";

  const BgComponent = BACKGROUNDS[bgKey] || OutdoorScene;

  // Speech bubble animation
  const bubbleDelay = 10;
  const bubbleSpring = spring({
    frame: Math.max(0, frame - bubbleDelay),
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 200 },
  });

  // Typewriter text
  const textLen = scene.text.length;
  const charsPerFrame = textLen / (scene.durationInFrames * 0.55);
  const visibleChars = Math.min(
    textLen,
    Math.floor(Math.max(0, frame - bubbleDelay - 6) * charsPerFrame)
  );
  const displayText = scene.text.substring(0, visibleChars);

  // Highlight logic
  const renderHighlightedText = (text: string) => {
    const highlights = scene.highlightWords || [];
    if (highlights.length === 0) return text;

    let parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;
    while (remaining.length > 0) {
      let earliest = remaining.length;
      let matched = "";
      for (const w of highlights) {
        const idx = remaining.toLowerCase().indexOf(w.toLowerCase());
        if (idx !== -1 && idx < earliest) { earliest = idx; matched = w; }
      }
      if (matched && earliest < remaining.length) {
        if (earliest > 0) parts.push(<span key={key++}>{remaining.substring(0, earliest)}</span>);
        parts.push(
          <span key={key++} style={{ color: "#FFD54F", fontWeight: 800, textShadow: "0 0 12px rgba(255,213,79,0.5)" }}>
            {remaining.substring(earliest, earliest + matched.length)}
          </span>
        );
        remaining = remaining.substring(earliest + matched.length);
      } else {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }
    }
    return <>{parts}</>;
  };

  // Position calculations
  const charX = position === "left" ? "15%" : position === "right" ? "60%" : "30%";
  const bubbleAlign = position === "left" ? "flex-start" : position === "right" ? "flex-end" : "center";

  return (
    <SceneTransition type="fade" durationInFrames={scene.durationInFrames}>
      <AbsoluteFill>
        {/* Scene background */}
        <BgComponent />

        {/* Semi-transparent overlay for readability */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.3) 100%)",
          }}
        />

        {/* Character container */}
        <div
          style={{
            position: "absolute",
            bottom: "22%",
            left: charX,
            transform: "translateX(-50%)",
          }}
        >
          <Character
            characterId={characterId}
            expression={expression}
            theme={theme}
            size={320}
            delay={0}
          />
        </div>

        {/* Speech bubble */}
        <div
          style={{
            position: "absolute",
            top: "8%",
            left: "5%",
            right: "5%",
            display: "flex",
            justifyContent: bubbleAlign,
            transform: `scale(${interpolate(bubbleSpring, [0, 1], [0.5, 1])})`,
            opacity: interpolate(bubbleSpring, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }),
            transformOrigin: position === "left" ? "bottom left" : position === "right" ? "bottom right" : "bottom center",
          }}
        >
          <div
            style={{
              maxWidth: "92%",
              position: "relative",
            }}
          >
            {/* Main bubble */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                borderRadius: 28,
                padding: "30px 34px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1)",
                border: "3px solid rgba(255,255,255,1)",
              }}
            >
              <div
                style={{
                  fontSize: 36,
                  fontFamily: "'Be Vietnam Pro', sans-serif",
                  fontWeight: 600,
                  color: "#1a1a2e",
                  lineHeight: 1.5,
                  textAlign: "left",
                }}
              >
                {renderHighlightedText(displayText)}
                {visibleChars < textLen && (
                  <span style={{ opacity: frame % 20 < 10 ? 1 : 0, color: "#4A90FF" }}>|</span>
                )}
              </div>
            </div>

            {/* Bubble tail */}
            <div
              style={{
                position: "absolute",
                bottom: -18,
                left: position === "right" ? "auto" : position === "left" ? "20%" : "50%",
                right: position === "right" ? "20%" : "auto",
                width: 0,
                height: 0,
                borderLeft: "18px solid transparent",
                borderRight: "18px solid transparent",
                borderTop: "22px solid rgba(255,255,255,0.95)",
                filter: "drop-shadow(0 4px 4px rgba(0,0,0,0.1))",
              }}
            />
          </div>
        </div>

        {/* Character name tag */}
        <div
          style={{
            position: "absolute",
            top: "5%",
            left: position === "left" ? "5%" : position === "right" ? "auto" : "50%",
            right: position === "right" ? "5%" : "auto",
            transform: position === "center" ? "translateX(-50%)" : "none",
            opacity: interpolate(bubbleSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
        </div>

        {/* Audio */}
        {scene.audioFile && <Audio src={staticFile(scene.audioFile)} />}
      </AbsoluteFill>
    </SceneTransition>
  );
};
