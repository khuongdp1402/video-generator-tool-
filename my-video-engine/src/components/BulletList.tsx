import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { ThemeColors } from "../types";

interface BulletListProps {
  bullets: string[];
  theme: ThemeColors;
  /** Frame delay before bullets start appearing */
  startDelay?: number;
}

/**
 * Animated bullet list with staggered spring entrance.
 * Each bullet pops in from the left with a checkmark icon.
 */
export const BulletList: React.FC<BulletListProps> = ({
  bullets,
  theme,
  startDelay = 20,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const staggerDelay = 15; // frames between each bullet

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        width: "100%",
        padding: "10px 0",
      }}
    >
      {bullets.map((bullet, i) => {
        const bulletDelay = startDelay + i * staggerDelay;
        const animFrame = Math.max(0, frame - bulletDelay);

        const slideProgress = spring({
          frame: animFrame,
          fps,
          config: { damping: 13, mass: 0.5, stiffness: 200 },
        });

        const translateX = interpolate(slideProgress, [0, 1], [-60, 0]);
        const opacity = interpolate(slideProgress, [0, 0.4], [0, 1], {
          extrapolateRight: "clamp",
        });

        // Check icon animation - slightly delayed after bullet appears
        const checkFrame = Math.max(0, animFrame - 5);
        const checkScale = spring({
          frame: checkFrame,
          fps,
          config: { damping: 10, mass: 0.3, stiffness: 300 },
        });

        return (
          <div
            key={`bullet-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              transform: `translateX(${translateX}px)`,
              opacity,
              willChange: "transform, opacity",
            }}
          >
            {/* Animated checkmark circle */}
            <div
              style={{
                width: 36,
                height: 36,
                minWidth: 36,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}88)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${checkScale})`,
                boxShadow: `0 0 12px ${theme.accentGlow}`,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={theme.bg1}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            {/* Bullet text */}
            <span
              style={{
                fontSize: 34,
                fontFamily: "'Be Vietnam Pro', 'Montserrat', sans-serif",
                fontWeight: 500,
                color: theme.text,
                lineHeight: 1.4,
              }}
            >
              {bullet}
            </span>
          </div>
        );
      })}
    </div>
  );
};
