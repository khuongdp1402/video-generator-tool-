import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { ThemeColors } from "../types";

interface SubtitleProps {
  text: string;
  highlightWords?: string[];
  theme: ThemeColors;
  /** Delay before the subtitle starts appearing (in frames) */
  startDelay?: number;
}

/**
 * Subtitle component with karaoke-style word highlighting.
 * Words appear with a staggered animation and highlighted words
 * get a special glow + scale effect.
 */
export const Subtitle: React.FC<SubtitleProps> = ({
  text,
  highlightWords = [],
  theme,
  startDelay = 10,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const words = text.split(/\s+/).filter(Boolean);
  const totalWords = words.length;

  // Distribute words evenly across the scene duration (leaving margin at end)
  const availableFrames = Math.max(30, durationInFrames - startDelay - 15);
  const framesPerWord = totalWords > 0 ? availableFrames / totalWords : 10;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "center",
        gap: "8px 12px",
        padding: "0 40px",
        lineHeight: 1.6,
      }}
    >
      {words.map((word, i) => {
        const wordStartFrame = startDelay + i * framesPerWord;
        const isActive =
          frame >= wordStartFrame && frame < wordStartFrame + framesPerWord;
        const isPast = frame >= wordStartFrame + framesPerWord;
        const isFuture = frame < wordStartFrame;

        // Check if this word is in highlightWords
        const isHighlight = highlightWords.some((hw) =>
          word.toLowerCase().includes(hw.toLowerCase()),
        );

        // Spring pop for active word
        const wordScale = spring({
          frame: Math.max(0, frame - wordStartFrame),
          fps,
          config: { damping: 12, mass: 0.4, stiffness: 200 },
        });

        // Fade in
        const wordOpacity = interpolate(
          frame,
          [wordStartFrame - 3, wordStartFrame],
          [0.3, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        let color = theme.textSecondary;
        let scale = 1;
        let textShadow = "none";
        let fontWeight: string | number = 600;

        if (isActive) {
          color = isHighlight ? theme.accent : theme.text;
          scale = isHighlight ? wordScale * 1.15 : wordScale * 1.05;
          textShadow = isHighlight
            ? `0 0 20px ${theme.accentGlow}, 0 0 40px ${theme.accentGlow}`
            : `0 0 10px rgba(255,255,255,0.2)`;
          fontWeight = 800;
        } else if (isPast) {
          color = isHighlight ? theme.accent : theme.text;
          scale = 1;
          textShadow = isHighlight
            ? `0 0 8px ${theme.accentGlow}`
            : "none";
          fontWeight = isHighlight ? 700 : 600;
        } else {
          // future word - dimmed
          color = theme.textSecondary;
          scale = 0.95;
        }

        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: "inline-block",
              fontSize: 42,
              fontFamily: "'Be Vietnam Pro', 'Montserrat', sans-serif",
              fontWeight,
              color,
              transform: `scale(${isFuture ? 0.95 : scale})`,
              opacity: isFuture ? 0.3 : wordOpacity,
              textShadow,
              transition: "color 0.1s",
              willChange: "transform, opacity",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
