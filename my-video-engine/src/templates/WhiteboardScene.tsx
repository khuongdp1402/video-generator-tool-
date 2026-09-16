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
import { SceneTransition } from "../components/SceneTransition";
import { Scene, ThemeColors } from "../types";

interface WhiteboardSceneProps {
  scene: Scene;
  theme: ThemeColors;
}

/**
 * Whiteboard/sketch-style scene for educational content.
 * Features hand-drawn SVG animations with draw-on effect.
 */
export const WhiteboardScene: React.FC<WhiteboardSceneProps> = ({
  scene,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const title = scene.title || "";
  const drawings = scene.drawings || [];

  // Title draw-in animation
  const titleProgress = spring({
    frame,
    fps,
    config: { damping: 20, mass: 1, stiffness: 80 },
  });

  // Typewriter for narration text
  const textDelay = 20;
  const textLen = scene.text.length;
  const charsPerFrame = textLen / (scene.durationInFrames * 0.5);
  const visibleChars = Math.min(
    textLen,
    Math.floor(Math.max(0, frame - textDelay) * charsPerFrame)
  );
  const displayText = scene.text.substring(0, visibleChars);

  // Drawing animations - staggered
  const drawingDelay = 15;
  const drawingStagger = 25;

  // Pencil cursor position
  const pencilVisible = frame > 5 && frame < scene.durationInFrames - 20;
  const pencilX = 100 + Math.sin(frame * 0.08) * 40;
  const pencilY = 400 + frame * 0.8;

  return (
    <SceneTransition type="fade" durationInFrames={scene.durationInFrames}>
      <AbsoluteFill>
        {/* Whiteboard background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#FAFAFA",
          }}
        />

        {/* Paper texture */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px)
            `,
            backgroundSize: "30px 30px",
          }}
        />

        {/* Notebook margin line */}
        <div
          style={{
            position: "absolute",
            left: 80,
            top: 0,
            bottom: 0,
            width: 2,
            background: "#FFB4B4",
            opacity: 0.5,
          }}
        />

        {/* Notebook holes */}
        {[150, 500, 850, 1200, 1550].map((y) => (
          <div
            key={`hole-${y}`}
            style={{
              position: "absolute",
              left: 25,
              top: y,
              width: 30,
              height: 30,
              borderRadius: "50%",
              border: "2px solid #DDD",
              background: "#F0F0F0",
            }}
          />
        ))}

        <AbsoluteFill
          style={{
            padding: "60px 100px 60px 120px",
            display: "flex",
            flexDirection: "column",
            gap: 30,
          }}
        >
          {/* Title with underline draw effect */}
          {title && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 52,
                  fontFamily: "'Caveat', 'Be Vietnam Pro', cursive, sans-serif",
                  fontWeight: 700,
                  color: "#2C3E50",
                  opacity: titleProgress,
                  transform: `translateX(${interpolate(titleProgress, [0, 1], [-20, 0])}px)`,
                }}
              >
                {title}
              </div>
              {/* Hand-drawn underline */}
              <svg width="100%" height="12" style={{ marginTop: 5, overflow: "visible" }}>
                <path
                  d="M 0 6 Q 100 2 200 8 Q 300 4 400 7 Q 500 3 600 6"
                  fill="none"
                  stroke="#E74C3C"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="600"
                  strokeDashoffset={interpolate(titleProgress, [0, 1], [600, 0])}
                />
              </svg>
            </div>
          )}

          {/* Drawing area */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 40,
              justifyContent: "center",
            }}
          >
            {drawings.map((drawing: any, i: number) => {
              const dDelay = drawingDelay + i * drawingStagger;
              const dProgress = spring({
                frame: Math.max(0, frame - dDelay),
                fps,
                config: { damping: 15, mass: 0.8, stiffness: 100 },
              });

              return (
                <div
                  key={`drawing-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 30,
                    opacity: dProgress,
                    transform: `translateY(${interpolate(dProgress, [0, 1], [30, 0])}px)`,
                  }}
                >
                  {/* Drawing SVG */}
                  <div style={{ minWidth: 120, display: "flex", justifyContent: "center" }}>
                    {renderDrawing(drawing.type, dProgress, theme)}
                  </div>

                  {/* Label */}
                  <div
                    style={{
                      fontSize: 38,
                      fontFamily: "'Caveat', 'Be Vietnam Pro', cursive, sans-serif",
                      fontWeight: 600,
                      color: "#2C3E50",
                      lineHeight: 1.4,
                    }}
                  >
                    {drawing.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Narration text at bottom */}
          <div
            style={{
              background: "rgba(44, 62, 80, 0.06)",
              borderRadius: 16,
              padding: "24px 30px",
              borderLeft: `4px solid ${theme.accent}`,
              minHeight: 120,
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontFamily: "'Be Vietnam Pro', sans-serif",
                fontWeight: 500,
                color: "#34495E",
                lineHeight: 1.6,
              }}
            >
              {displayText}
              {visibleChars < textLen && (
                <span style={{ opacity: frame % 20 < 10 ? 1 : 0, color: "#E74C3C" }}>|</span>
              )}
            </div>
          </div>
        </AbsoluteFill>

        {/* Pencil cursor */}
        {pencilVisible && (
          <div
            style={{
              position: "absolute",
              left: pencilX,
              top: Math.min(pencilY, 1600),
              opacity: 0.6,
              transform: "rotate(-45deg)",
              fontSize: 28,
            }}
          >
            ✏️
          </div>
        )}

        {/* Audio */}
        {scene.audioFile && <Audio src={staticFile(scene.audioFile)} />}
      </AbsoluteFill>
    </SceneTransition>
  );
};

/**
 * Renders a specific drawing type as animated SVG.
 */
function renderDrawing(type: string, progress: number, theme: ThemeColors): React.ReactNode {
  const dashOffset = interpolate(progress, [0, 1], [300, 0]);
  const strokeColor = "#2C3E50";

  switch (type) {
    case "sun":
      return (
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="25" fill="none" stroke="#F39C12" strokeWidth="3"
            strokeDasharray="160" strokeDashoffset={dashOffset * 0.5} />
          <circle cx="50" cy="50" r="18" fill={`rgba(243, 156, 18, ${progress * 0.3})`} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
            <line key={`sr-${i}`}
              x1={50 + Math.cos(angle * Math.PI / 180) * 30}
              y1={50 + Math.sin(angle * Math.PI / 180) * 30}
              x2={50 + Math.cos(angle * Math.PI / 180) * 42}
              y2={50 + Math.sin(angle * Math.PI / 180) * 42}
              stroke="#F39C12" strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray="20" strokeDashoffset={dashOffset * 0.1}
            />
          ))}
        </svg>
      );

    case "lightwave":
    case "wave":
      return (
        <svg width="120" height="60" viewBox="0 0 120 60">
          <path d="M 5 30 Q 20 5 35 30 Q 50 55 65 30 Q 80 5 95 30 Q 110 55 115 30"
            fill="none" stroke="#3498DB" strokeWidth="3" strokeLinecap="round"
            strokeDasharray="200" strokeDashoffset={dashOffset * 0.7} />
          {/* Small wavelength label arrow */}
          <path d="M 20 48 L 65 48" fill="none" stroke="#E74C3C" strokeWidth="1.5"
            strokeDasharray="50" strokeDashoffset={dashOffset * 0.3}
            markerEnd="url(#arrowRed)" />
        </svg>
      );

    case "atmosphere":
      return (
        <svg width="120" height="100" viewBox="0 0 120 100">
          {/* Earth curve */}
          <path d="M 0 90 Q 60 70 120 90" fill={`rgba(46, 204, 113, ${progress * 0.3})`}
            stroke="#27AE60" strokeWidth="2.5"
            strokeDasharray="200" strokeDashoffset={dashOffset * 0.7} />
          {/* Atmosphere layers */}
          <path d="M 10 70 Q 60 50 110 70" fill="none" stroke="#3498DB" strokeWidth="2" opacity="0.7"
            strokeDasharray="150" strokeDashoffset={dashOffset * 0.5} />
          <path d="M 20 50 Q 60 30 100 50" fill="none" stroke="#3498DB" strokeWidth="1.5" opacity="0.4"
            strokeDasharray="120" strokeDashoffset={dashOffset * 0.4} />
          {/* Scattered dots (particles) */}
          {[30, 50, 70, 90].map((x, i) => (
            <circle key={`p-${i}`} cx={x} cy={55 + i * 3} r={2} fill="#3498DB"
              opacity={progress * 0.6} />
          ))}
        </svg>
      );

    case "eye":
      return (
        <svg width="100" height="70" viewBox="0 0 100 70">
          <ellipse cx="50" cy="35" rx="40" ry="25" fill="none" stroke={strokeColor} strokeWidth="2.5"
            strokeDasharray="200" strokeDashoffset={dashOffset * 0.7} />
          <circle cx="50" cy="35" r="15" fill="none" stroke="#3498DB" strokeWidth="2"
            strokeDasharray="100" strokeDashoffset={dashOffset * 0.4} />
          <circle cx="50" cy="35" r="8" fill={`rgba(52, 152, 219, ${progress * 0.5})`}
            stroke={strokeColor} strokeWidth="1.5"
            strokeDasharray="50" strokeDashoffset={dashOffset * 0.2} />
          <circle cx="46" cy="31" r="3" fill={`rgba(255,255,255,${progress})`} />
        </svg>
      );

    case "beaker":
      return (
        <svg width="80" height="100" viewBox="0 0 80 100">
          {/* Beaker body */}
          <path d="M 20 20 L 20 80 Q 20 90 30 90 L 50 90 Q 60 90 60 80 L 60 20"
            fill="none" stroke={strokeColor} strokeWidth="2.5"
            strokeDasharray="300" strokeDashoffset={dashOffset} />
          {/* Liquid */}
          <rect x="22" y="50" width="36" height="38" rx="3"
            fill={`rgba(52, 152, 219, ${progress * 0.4})`} />
          {/* Bubbles */}
          <circle cx="35" cy={60 - progress * 15} r="3" fill={`rgba(52, 152, 219, ${progress * 0.5})`} />
          <circle cx="45" cy={65 - progress * 10} r="2" fill={`rgba(52, 152, 219, ${progress * 0.4})`} />
          {/* Rim */}
          <line x1="15" y1="20" x2="65" y2="20" stroke={strokeColor} strokeWidth="2.5"
            strokeDasharray="50" strokeDashoffset={dashOffset * 0.2} />
        </svg>
      );

    case "arrow":
      return (
        <svg width="100" height="50" viewBox="0 0 100 50">
          <path d="M 10 25 L 80 25" fill="none" stroke="#E74C3C" strokeWidth="3" strokeLinecap="round"
            strokeDasharray="80" strokeDashoffset={dashOffset * 0.3} />
          <path d="M 70 15 L 85 25 L 70 35" fill="none" stroke="#E74C3C" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="40" strokeDashoffset={dashOffset * 0.15} />
        </svg>
      );

    case "molecules":
      return (
        <svg width="100" height="80" viewBox="0 0 100 80">
          {/* Water molecule H2O */}
          <circle cx="50" cy="30" r="14" fill={`rgba(231, 76, 60, ${progress * 0.3})`} stroke="#E74C3C" strokeWidth="2"
            strokeDasharray="100" strokeDashoffset={dashOffset * 0.4} />
          <circle cx="30" cy="55" r="9" fill={`rgba(52, 152, 219, ${progress * 0.3})`} stroke="#3498DB" strokeWidth="2"
            strokeDasharray="60" strokeDashoffset={dashOffset * 0.25} />
          <circle cx="70" cy="55" r="9" fill={`rgba(52, 152, 219, ${progress * 0.3})`} stroke="#3498DB" strokeWidth="2"
            strokeDasharray="60" strokeDashoffset={dashOffset * 0.25} />
          {/* Bonds */}
          <line x1="42" y1="40" x2="34" y2="48" stroke={strokeColor} strokeWidth="2"
            strokeDasharray="20" strokeDashoffset={dashOffset * 0.1} />
          <line x1="58" y1="40" x2="66" y2="48" stroke={strokeColor} strokeWidth="2"
            strokeDasharray="20" strokeDashoffset={dashOffset * 0.1} />
          {/* Labels */}
          <text x="50" y="35" textAnchor="middle" fontSize="12" fill={strokeColor} fontWeight="bold" opacity={progress}>O</text>
          <text x="30" y="59" textAnchor="middle" fontSize="10" fill={strokeColor} fontWeight="bold" opacity={progress}>H</text>
          <text x="70" y="59" textAnchor="middle" fontSize="10" fill={strokeColor} fontWeight="bold" opacity={progress}>H</text>
        </svg>
      );

    case "star":
      return (
        <svg width="80" height="80" viewBox="0 0 80 80">
          <path d="M 40 5 L 48 28 L 75 28 L 54 44 L 62 70 L 40 54 L 18 70 L 26 44 L 5 28 L 32 28 Z"
            fill={`rgba(241, 196, 15, ${progress * 0.3})`} stroke="#F1C40F" strokeWidth="2.5"
            strokeDasharray="300" strokeDashoffset={dashOffset} strokeLinejoin="round" />
        </svg>
      );

    case "checkmark":
      return (
        <svg width="60" height="60" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="25" fill="none" stroke="#27AE60" strokeWidth="3"
            strokeDasharray="160" strokeDashoffset={dashOffset * 0.5} />
          <path d="M 18 30 L 26 40 L 44 20" fill="none" stroke="#27AE60" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="50" strokeDashoffset={dashOffset * 0.2} />
        </svg>
      );

    default:
      return (
        <svg width="80" height="80" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="30" fill="none" stroke={strokeColor} strokeWidth="2.5"
            strokeDasharray="200" strokeDashoffset={dashOffset * 0.7} />
        </svg>
      );
  }
}
