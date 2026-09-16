import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

interface SceneTransitionProps {
  type?: "fade" | "slide-up" | "zoom";
  /** Total frames for the transition effect */
  transitionDuration?: number;
  durationInFrames: number;
}

/**
 * Scene transition wrapper that applies entrance and exit animations.
 * Wraps a scene's content and handles fade/slide/zoom transitions.
 */
export const SceneTransition: React.FC<
  React.PropsWithChildren<SceneTransitionProps>
> = ({
  children,
  type = "fade",
  transitionDuration = 8,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();

  // Entrance animation (first N frames)
  const enterProgress = interpolate(
    frame,
    [0, transitionDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Exit animation (last N frames)
  const exitStart = durationInFrames - transitionDuration;
  const exitProgress = interpolate(
    frame,
    [exitStart, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Combined progress (min of enter and exit)
  const progress = Math.min(enterProgress, exitProgress);

  let style: React.CSSProperties = {};

  switch (type) {
    case "fade":
      style = {
        opacity: progress,
      };
      break;
    case "slide-up": {
      const translateY = interpolate(enterProgress, [0, 1], [40, 0]);
      style = {
        opacity: progress,
        transform: `translateY(${frame < transitionDuration ? translateY : 0}px)`,
      };
      break;
    }
    case "zoom": {
      const scale = interpolate(enterProgress, [0, 1], [0.92, 1]);
      style = {
        opacity: progress,
        transform: `scale(${frame < transitionDuration ? scale : frame > exitStart ? interpolate(exitProgress, [0, 1], [1.05, 1]) : 1})`,
      };
      break;
    }
  }

  return (
    <AbsoluteFill
      style={{
        ...style,
        willChange: "transform, opacity"
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
