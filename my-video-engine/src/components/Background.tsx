import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { ThemeColors } from "../types";

interface BackgroundProps {
  theme: ThemeColors;
}

export const Background: React.FC<BackgroundProps> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Slow rotating gradient angle
  const gradientAngle = interpolate(frame, [0, durationInFrames], [135, 225], {
    extrapolateRight: "clamp",
  });

  // Grid animation - slow drift
  const gridOffsetY = interpolate(frame, [0, durationInFrames], [0, -200], {
    extrapolateRight: "clamp",
  });

  // Subtle pulse for the accent glow orb
  const orbScale = interpolate(
    frame % 120,
    [0, 60, 120],
    [1, 1.15, 1],
  );

  const orbOpacity = interpolate(
    frame % 120,
    [0, 60, 120],
    [0.15, 0.3, 0.15],
  );

  return (
    <AbsoluteFill>
      {/* Base gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(${gradientAngle}deg, ${theme.bg1} 0%, ${theme.bg2} 50%, ${theme.bg1} 100%)`,
        }}
      />

      {/* Animated grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(${theme.cardBorder} 1px, transparent 1px),
            linear-gradient(90deg, ${theme.cardBorder} 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
          backgroundPosition: `0px ${gridOffsetY}px`,
          opacity: 0.15,
          maskImage:
            "radial-gradient(ellipse at center, black 20%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 20%, transparent 70%)",
        }}
      />

      {/* Accent glow orb - top right */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          right: "-10%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${theme.accentGlow} 0%, transparent 70%)`,
          transform: `scale(${orbScale})`,
          opacity: orbOpacity,
          filter: "blur(40px)",
        }}
      />

      {/* Secondary glow orb - bottom left */}
      <div
        style={{
          position: "absolute",
          bottom: "5%",
          left: "-15%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${theme.accentGlow} 0%, transparent 70%)`,
          transform: `scale(${orbScale * 0.85})`,
          opacity: orbOpacity * 0.6,
          filter: "blur(60px)",
        }}
      />

      {/* Noise texture overlay for premium feel */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />
    </AbsoluteFill>
  );
};
