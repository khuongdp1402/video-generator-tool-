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
import { Scene, ThemeColors } from "../types";
import { Subtitle } from "../components/Subtitle";

interface MinimalistSceneProps {
  scene: Scene;
  theme: ThemeColors;
}

export const MinimalistScene: React.FC<MinimalistSceneProps> = ({
  scene,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Determine dark or light mode based on scene.inverted
  const isLight = Boolean(scene.inverted);
  const bgColor = isLight ? "#FFFFFF" : "#0A0A0A";
  const fgColor = isLight ? "#111111" : "#FFFFFF";
  const accentColor = "#F59E0B"; // Energetic golden amber accent

  // Overall scene entrance
  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 120 },
  });

  // Floating ambient motion
  const floatY = Math.sin(frame * 0.05) * 8;

  // Scene audio
  const audioSrc = scene.audioFile ? staticFile(scene.audioFile) : null;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgColor,
        fontFamily: "'Montserrat', 'Be Vietnam Pro', sans-serif",
      }}
    >
      {audioSrc && <Audio src={audioSrc} />}

      {/* Main Visual Metaphor Container (Centered Upper 65%) */}
      <AbsoluteFill
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "65%",
          transform: `scale(${entrance}) translateY(${floatY}px)`,
          opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <div
          style={{
            width: 540,
            height: 540,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {renderMetaphor(scene.metaphor || scene.icon || "lightbulb", frame, fps, fgColor, accentColor)}
        </div>
      </AbsoluteFill>

      {/* Subtitle / Narration Container (Lower 35%) */}
      <AbsoluteFill
        style={{
          top: "65%",
          height: "35%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "0 50px 70px 50px",
        }}
      >
        <Subtitle
          text={scene.text}
          highlightWords={scene.highlightWords || ["tiền", "tri thức", "giá trị", "khuôn đúc", "đòn bẩy", "bền vững"]}
          theme={{
            ...theme,
            text: fgColor,
            textSecondary: isLight ? "#666666" : "#A3A3A3",
            accent: accentColor,
          }}
          startDelay={8}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

function renderMetaphor(
  metaphor: string,
  frame: number,
  fps: number,
  fgColor: string,
  accentColor: string
) {
  switch (metaphor) {
    case "scale":
    case "scale-choice":
      return renderScaleChoice(frame, fgColor, accentColor);
    case "funnel":
    case "funnel-leak":
      return renderFunnelLeak(frame, fgColor, accentColor);
    case "brain-gears":
      return renderBrainGears(frame, fgColor, accentColor);
    case "growth-chart":
      return renderGrowthChart(frame, fgColor, accentColor);
    case "key-door":
    case "door":
      return renderKeyDoor(frame, fgColor, accentColor);
    default:
      return renderLightbulb(frame, fgColor, accentColor);
  }
}

/**
 * 1. Balance Scale: Choice between Money (stack) vs Knowledge (glowing book/brain)
 */
function renderScaleChoice(frame: number, fg: string, accent: string) {
  const tilt = Math.sin(frame * 0.06) * 5; // Slight organic tilt
  const glow = 0.6 + Math.sin(frame * 0.1) * 0.4;

  return (
    <svg width="460" height="400" viewBox="0 0 460 400" fill="none">
      {/* Central Fulcrum Stand */}
      <polygon points="230,220 200,340 260,340" fill={fg} />
      <circle cx="230" cy="220" r="14" fill={accent} />
      <line x1="150" y1="340" x2="310" y2="340" stroke={fg} strokeWidth="6" strokeLinecap="round" />

      {/* Tilting Beam */}
      <g transform={`rotate(${tilt} 230 220)`}>
        <line x1="70" y1="220" x2="390" y2="220" stroke={fg} strokeWidth="8" strokeLinecap="round" />

        {/* Left Pan: Money Stack */}
        <line x1="70" y1="220" x2="70" y2="280" stroke={fg} strokeWidth="4" />
        <path d="M 20 280 Q 70 305 120 280 Z" fill={fg} />
        {/* Money Icons on Left */}
        <g transform="translate(45, 230)">
          <rect x="0" y="15" width="50" height="28" rx="4" stroke={fg} strokeWidth="3" fill="none" />
          <text x="25" y="34" fill={accent} fontSize="18" fontWeight="bold" textAnchor="middle">$</text>
          <rect x="5" y="5" width="50" height="28" rx="4" stroke={fg} strokeWidth="3" fill="none" />
          <text x="30" y="24" fill={accent} fontSize="18" fontWeight="bold" textAnchor="middle">$</text>
        </g>

        {/* Right Pan: Glowing Knowledge (Open Book + Rays) */}
        <line x1="390" y1="220" x2="390" y2="280" stroke={fg} strokeWidth="4" />
        <path d="M 340 280 Q 390 305 440 280 Z" fill={fg} />
        {/* Book / Knowledge Icon on Right */}
        <g transform="translate(365, 220)">
          {/* Glowing Aura */}
          <circle cx="25" cy="18" r="30" fill={accent} opacity={glow * 0.3} />
          {/* Open Book Wings */}
          <path d="M 25 30 C 15 20 0 25 -5 20 L -5 5 C 0 10 15 5 25 15 Z" fill={fg} />
          <path d="M 25 30 C 35 20 50 25 55 20 L 55 5 C 50 10 35 5 25 15 Z" fill={fg} />
          {/* Radiant Star of Wisdom */}
          <polygon
            points="25,0 28,10 38,10 30,16 33,26 25,20 17,26 20,16 12,10 22,10"
            fill={accent}
            transform="scale(0.7) translate(10, -10)"
          />
        </g>
      </g>
    </svg>
  );
}

/**
 * 2. Funnel with leaking money (Tiền không có tri thức như nước đổ vào túi rách)
 */
function renderFunnelLeak(frame: number, fg: string, accent: string) {
  // Falling coin positions
  const coin1Y = (frame * 6) % 180;
  const coin2Y = ((frame * 6) + 70) % 180;

  return (
    <svg width="420" height="420" viewBox="0 0 420 420" fill="none">
      {/* Funnel Outline */}
      <path
        d="M 80 80 L 340 80 L 240 220 L 240 280 L 225 280 L 225 310"
        stroke={fg}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 180 220 L 180 280 L 195 280 L 195 310"
        stroke={fg}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Leaking Broken Gap in Pipe */}
      <line x1="195" y1="280" x2="225" y2="280" stroke="#EF4444" strokeWidth="4" strokeDasharray="4 4" />

      {/* Top Coins falling into funnel */}
      <g transform="translate(195, 40)">
        <circle cx="15" cy={coin1Y < 120 ? coin1Y : 120} r="16" stroke={accent} strokeWidth="4" fill="none" />
        <text x="15" y={(coin1Y < 120 ? coin1Y : 120) + 5} fill={accent} fontSize="14" fontWeight="bold" textAnchor="middle">$</text>
      </g>

      {/* Coins falling OUT through the bottom gap & dissolving */}
      {coin2Y > 60 && (
        <g transform={`translate(195, ${290 + (coin2Y - 60) * 0.8})`}>
          <circle cx="15" cy="15" r="14" stroke={fg} strokeWidth="3" fill="none" opacity={Math.max(0, 1 - (coin2Y - 60) / 100)} />
          {/* Dust / Dispersal particles */}
          <circle cx="-10" cy="20" r="3" fill={fg} opacity={0.5} />
          <circle cx="40" cy="10" r="3" fill={fg} opacity={0.4} />
          <circle cx="15" cy="40" r="4" fill="#EF4444" opacity={0.6} />
        </g>
      )}

      {/* Cross mark on bottom warning leak */}
      <text x="210" y="390" fill="#EF4444" fontSize="22" fontWeight="bold" textAnchor="middle">
        ✕ KHÔNG THỂ GIỮ
      </text>
    </svg>
  );
}

/**
 * 3. Brain & Gears: Knowledge is the Mint/Forge of Wealth
 */
function renderBrainGears(frame: number, fg: string, accent: string) {
  const gear1Angle = (frame * 2.5) % 360;
  const gear2Angle = (-frame * 2.5) % 360;

  return (
    <svg width="460" height="420" viewBox="0 0 460 420" fill="none">
      {/* Head profile / Brain silhouette */}
      <path
        d="M 120 360 L 120 300 C 70 280 60 210 80 160 C 100 110 160 80 230 80 C 310 80 370 120 380 200 C 390 260 350 310 320 330 L 320 360"
        stroke={fg}
        strokeWidth="6"
        strokeLinecap="round"
      />

      {/* Interlocking Gear 1 (Main Wisdom Gear) */}
      <g transform={`translate(200, 200) rotate(${gear1Angle})`}>
        <circle cx="0" cy="0" r="46" stroke={fg} strokeWidth="6" fill="none" />
        <circle cx="0" cy="0" r="16" fill={accent} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((ang) => (
          <rect
            key={ang}
            x="-8"
            y="-56"
            width="16"
            height="18"
            rx="3"
            fill={fg}
            transform={`rotate(${ang})`}
          />
        ))}
      </g>

      {/* Interlocking Gear 2 (Value Generator) */}
      <g transform={`translate(280, 150) rotate(${gear2Angle})`}>
        <circle cx="0" cy="0" r="32" stroke={fg} strokeWidth="5" fill="none" />
        <circle cx="0" cy="0" r="10" fill={fg} />
        {[0, 60, 120, 180, 240, 300].map((ang) => (
          <rect
            key={ang}
            x="-6"
            y="-40"
            width="12"
            height="14"
            rx="2"
            fill={fg}
            transform={`rotate(${ang})`}
          />
        ))}
      </g>

      {/* Continuous Minting Stream of Coins issuing to the right */}
      {[0, 1, 2].map((idx) => {
        const offset = ((frame * 4) + idx * 50) % 150;
        return (
          <g key={idx} transform={`translate(${330 + offset}, ${260 + Math.sin((frame + idx * 30) * 0.1) * 15})`}>
            <circle cx="0" cy="0" r="18" fill={accent} stroke={fg} strokeWidth="3" />
            <text x="0" y="6" fill="#000" fontSize="16" fontWeight="bold" textAnchor="middle">$</text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * 4. Exponential Growth Curve (Đòn bẩy tri thức)
 */
function renderGrowthChart(frame: number, fg: string, accent: string) {
  const drawProgress = Math.min(1, frame / 45);
  const arrowHeadX = 80 + drawProgress * 280;
  const arrowHeadY = 330 - Math.pow(drawProgress, 2.2) * 230;

  return (
    <svg width="440" height="420" viewBox="0 0 440 420" fill="none">
      {/* Coordinate Axes */}
      <line x1="80" y1="60" x2="80" y2="340" stroke={fg} strokeWidth="5" strokeLinecap="round" />
      <line x1="80" y1="340" x2="380" y2="340" stroke={fg} strokeWidth="5" strokeLinecap="round" />

      {/* Axis Labels */}
      <text x="60" y="70" fill={fg} fontSize="18" fontWeight="600" textAnchor="end">Giá Trị</text>
      <text x="380" y="375" fill={fg} fontSize="18" fontWeight="600" textAnchor="end">Thời Gian</text>

      {/* Flat baseline: Tiền mặt hữu hạn (tiêu là giảm) */}
      <line x1="80" y1="220" x2="340" y2="280" stroke="#737373" strokeWidth="4" strokeDasharray="8 8" />
      <text x="345" y="285" fill="#737373" fontSize="16" fontWeight="bold">Tiền mặt</text>

      {/* Dynamic Exponential Curve: Tri Thức (Sinh sôi vô hạn) */}
      <path
        d="M 80 330 Q 220 320 360 100"
        stroke={accent}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray="400"
        strokeDashoffset={400 * (1 - drawProgress)}
      />

      {/* Glowing Star/Rocket at the peak */}
      {drawProgress > 0.4 && (
        <g transform={`translate(${arrowHeadX}, ${arrowHeadY})`}>
          <circle cx="0" cy="0" r="10" fill={accent} />
          <circle cx="0" cy="0" r="22" fill={accent} opacity={0.4} />
          <text x="15" y="-12" fill={accent} fontSize="20" fontWeight="bold">TRI THỨC 🚀</text>
        </g>
      )}
    </svg>
  );
}

/**
 * 5. Monolith Doorway & Glowing Master Key (Cánh cửa cơ hội - Chuẩn @shortformconversions frame 30)
 */
function renderKeyDoor(frame: number, fg: string, accent: string) {
  // Door perspective angle
  const doorOpen = Math.min(30, frame * 0.8);
  const keyFloat = Math.sin(frame * 0.08) * 10;

  return (
    <svg width="440" height="440" viewBox="0 0 440 440" fill="none">
      {/* Radiant Glow Behind Door */}
      <defs>
        <radialGradient id="portalGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.8" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="180" y="80" width="140" height="260" fill="url(#portalGlow)" opacity={0.7} />

      {/* Door Frame (Tall Monolith in perspective) */}
      <rect x="200" y="80" width="100" height="260" stroke={fg} strokeWidth="6" fill="none" />

      {/* Swinging Door Blade in 3D perspective */}
      <polygon
        points={`200,80 ${200 + doorOpen * 1.5},${80 - doorOpen * 0.5} ${200 + doorOpen * 1.5},${340 - doorOpen * 0.5} 200,340`}
        fill={fg}
      />

      {/* Master Key (Knowledge) floating into keyhole */}
      <g transform={`translate(${110 + Math.min(70, frame * 2)}, ${210 + keyFloat})`}>
        {/* Key Head */}
        <circle cx="0" cy="0" r="22" stroke={accent} strokeWidth="6" fill="none" />
        <circle cx="0" cy="0" r="8" fill={accent} />
        {/* Key Shaft */}
        <line x1="22" y1="0" x2="65" y2="0" stroke={accent} strokeWidth="6" strokeLinecap="round" />
        {/* Key Teeth */}
        <line x1="50" y1="0" x2="50" y2="15" stroke={accent} strokeWidth="6" strokeLinecap="round" />
        <line x1="62" y1="0" x2="62" y2="12" stroke={accent} strokeWidth="6" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/**
 * Fallback: Minimalist Lightbulb (Ý tưởng / Nhận thức)
 */
function renderLightbulb(frame: number, fg: string, accent: string) {
  const pulse = 0.5 + Math.sin(frame * 0.1) * 0.5;

  return (
    <svg width="360" height="380" viewBox="0 0 360 380" fill="none">
      {/* Radiant Aura */}
      <circle cx="180" cy="150" r="100" fill={accent} opacity={pulse * 0.25} />

      {/* Glass Bulb Outline */}
      <path
        d="M 140 240 C 120 220 100 180 100 140 C 100 95 135 60 180 60 C 225 60 260 95 260 140 C 260 180 240 220 220 240 Z"
        stroke={fg}
        strokeWidth="6"
        fill="none"
      />

      {/* Filament */}
      <path
        d="M 160 220 L 160 160 L 175 140 L 185 140 L 200 160 L 200 220"
        stroke={accent}
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* Base Screw */}
      <rect x="150" y="244" width="60" height="12" rx="4" fill={fg} />
      <rect x="155" y="260" width="50" height="12" rx="4" fill={fg} />
      <path d="M 165 276 Q 180 286 195 276 Z" fill={fg} />
    </svg>
  );
}
