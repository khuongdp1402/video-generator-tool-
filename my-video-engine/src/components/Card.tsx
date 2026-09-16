import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { ThemeColors } from "../types";

interface CardProps {
  children: React.ReactNode;
  theme: ThemeColors;
  /** Delay before the card appears */
  delay?: number;
  /** Direction from which the card slides in */
  direction?: "bottom" | "left" | "right";
}

/**
 * Animated card with gradient border, glassmorphism background,
 * and spring-based pop-in animation.
 */
export const Card: React.FC<CardProps> = ({
  children,
  theme,
  delay = 0,
  direction = "bottom",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const animFrame = Math.max(0, frame - delay);

  const progress = spring({
    frame: animFrame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 180 },
  });

  // Slide offset based on direction
  const slideDistance = 80;
  let translateX = 0;
  let translateY = 0;

  if (direction === "bottom") {
    translateY = interpolate(progress, [0, 1], [slideDistance, 0]);
  } else if (direction === "left") {
    translateX = interpolate(progress, [0, 1], [-slideDistance, 0]);
  } else if (direction === "right") {
    translateX = interpolate(progress, [0, 1], [slideDistance, 0]);
  }

  const opacity = interpolate(progress, [0, 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Subtle border glow animation
  const borderGlow = interpolate(
    frame % 180,
    [0, 90, 180],
    [0.3, 0.6, 0.3],
  );

  return (
    <div
      style={{
        transform: `translate(${translateX}px, ${translateY}px) scale(${interpolate(progress, [0, 1], [0.9, 1])})`,
        opacity,
        willChange: "transform, opacity",
      }}
    >
      {/* Outer glow border */}
      <div
        style={{
          padding: 2,
          borderRadius: 24,
          background: `linear-gradient(135deg, ${theme.accent}${Math.round(borderGlow * 255).toString(16).padStart(2, "0")}, transparent 50%, ${theme.accent}${Math.round(borderGlow * 128).toString(16).padStart(2, "0")})`,
        }}
      >
        {/* Card body */}
        <div
          style={{
            background: theme.cardBg,
            backdropFilter: "blur(20px)",
            borderRadius: 22,
            padding: "40px 36px",
            boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
