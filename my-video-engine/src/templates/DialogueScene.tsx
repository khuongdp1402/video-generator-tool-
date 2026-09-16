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
import { Character } from "../components/Character";
import { SceneTransition } from "../components/SceneTransition";
import { Scene, ThemeColors } from "../types";

interface DialogueSceneProps {
  scene: Scene;
  theme: ThemeColors;
}

/**
 * Dialogue scene - shows a character with a speech bubble.
 * Character enters from side, speech bubble pops in after.
 */
export const DialogueScene: React.FC<DialogueSceneProps> = ({
  scene,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const characterId = scene.characterId || "minh";
  const expression = (scene.expression as any) || "happy";

  // Speech bubble animation
  const bubbleDelay = 12;
  const bubbleSpring = spring({
    frame: Math.max(0, frame - bubbleDelay),
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 200 },
  });

  const bubbleScale = interpolate(bubbleSpring, [0, 1], [0.3, 1]);
  const bubbleOpacity = interpolate(bubbleSpring, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Text typewriter effect
  const textLength = scene.text.length;
  const charsPerFrame = textLength / (scene.durationInFrames * 0.6);
  const visibleChars = Math.min(
    textLength,
    Math.floor(Math.max(0, frame - bubbleDelay - 8) * charsPerFrame)
  );
  const displayText = scene.text.substring(0, visibleChars);

  // Highlight words in the text
  const highlightText = (text: string, highlights: string[]) => {
    if (!highlights || highlights.length === 0) return text;
    
    let result: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      let earliestIndex = remaining.length;
      let matchedWord = "";

      for (const word of highlights) {
        const idx = remaining.toLowerCase().indexOf(word.toLowerCase());
        if (idx !== -1 && idx < earliestIndex) {
          earliestIndex = idx;
          matchedWord = word;
        }
      }

      if (matchedWord && earliestIndex < remaining.length) {
        if (earliestIndex > 0) {
          result.push(
            <span key={key++}>{remaining.substring(0, earliestIndex)}</span>
          );
        }
        result.push(
          <span
            key={key++}
            style={{
              color: theme.accent,
              fontWeight: 800,
              textShadow: `0 0 15px ${theme.accentGlow}`,
            }}
          >
            {remaining.substring(earliestIndex, earliestIndex + matchedWord.length)}
          </span>
        );
        remaining = remaining.substring(earliestIndex + matchedWord.length);
      } else {
        result.push(<span key={key++}>{remaining}</span>);
        break;
      }
    }

    return <>{result}</>;
  };

  // Emoji based on expression
  const expressionEmoji: Record<string, string> = {
    happy: "😄",
    shocked: "😱",
    sad: "😢",
    angry: "😤",
  };

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
            padding: "60px 40px",
            gap: 30,
          }}
        >
          {/* Expression emoji floating */}
          <div
            style={{
              fontSize: 60,
              transform: `scale(${bubbleSpring}) translateY(${interpolate(frame % 40, [0, 20, 40], [0, -10, 0])}px)`,
              opacity: bubbleOpacity,
            }}
          >
            {expressionEmoji[expression] || "😄"}
          </div>

          {/* Character */}
          <Character
            characterId={characterId}
            expression={expression}
            theme={theme}
            size={280}
            delay={0}
          />

          {/* Speech bubble */}
          <div
            style={{
              transform: `scale(${bubbleScale})`,
              opacity: bubbleOpacity,
              position: "relative",
              maxWidth: "90%",
              willChange: "transform, opacity",
            }}
          >
            {/* Bubble arrow (pointing up to character) */}
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: "15px solid transparent",
                borderRight: "15px solid transparent",
                borderBottom: `20px solid ${theme.cardBg}`,
                margin: "0 auto",
                filter: `drop-shadow(0 -2px 4px ${theme.accent}22)`,
              }}
            />

            {/* Bubble body */}
            <div
              style={{
                background: theme.cardBg,
                backdropFilter: "blur(20px)",
                borderRadius: 24,
                padding: "30px 36px",
                border: `2px solid ${theme.cardBorder}`,
                boxShadow: `0 8px 32px rgba(0,0,0,0.3), 0 0 20px ${theme.accentGlow}`,
              }}
            >
              <div
                style={{
                  fontSize: 38,
                  fontFamily: "'Be Vietnam Pro', sans-serif",
                  fontWeight: 600,
                  color: theme.text,
                  lineHeight: 1.5,
                  textAlign: "center",
                }}
              >
                {highlightText(displayText, scene.highlightWords || [])}
                {/* Blinking cursor */}
                {visibleChars < textLength && (
                  <span
                    style={{
                      opacity: frame % 20 < 10 ? 1 : 0,
                      color: theme.accent,
                      fontWeight: 400,
                    }}
                  >
                    |
                  </span>
                )}
              </div>
            </div>
          </div>
        </AbsoluteFill>

        {/* Audio */}
        {scene.audioFile && <Audio src={staticFile(scene.audioFile)} />}
      </AbsoluteFill>
    </SceneTransition>
  );
};
