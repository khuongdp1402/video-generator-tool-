import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { ThemeColors } from "../types";

export interface CharacterConfig {
  name: string;
  color: string;       // Main accent color
  skinTone: string;     // Skin color
  hairColor: string;
  accessory?: "glasses" | "headband" | "earring";
  expression?: "happy" | "shocked" | "sad" | "angry";
}

export const CHARACTERS: Record<string, CharacterConfig> = {
  minh: {
    name: "Minh",
    color: "#4A90FF",
    skinTone: "#FFDBB4",
    hairColor: "#2C1810",
    accessory: "glasses",
    expression: "happy",
  },
  lan: {
    name: "Lan",
    color: "#FF6B9D",
    skinTone: "#FFE0BD",
    hairColor: "#4A2800",
    accessory: "earring",
    expression: "happy",
  },
  tung: {
    name: "Tùng",
    color: "#4ECDC4",
    skinTone: "#F5D0A9",
    hairColor: "#1A1A2E",
    accessory: "headband",
    expression: "happy",
  },
};

interface CharacterProps {
  characterId: string;
  expression?: "happy" | "shocked" | "sad" | "angry";
  theme: ThemeColors;
  size?: number;
  delay?: number;
}

/**
 * Animated cartoon character avatar with expressions.
 */
export const Character: React.FC<CharacterProps> = ({
  characterId,
  expression,
  theme,
  size = 280,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const char = CHARACTERS[characterId] || CHARACTERS.minh;
  const expr = expression || char.expression || "happy";

  // Bounce-in animation
  const entrySpring = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 10, mass: 0.6, stiffness: 180 },
  });

  // Idle bobbing animation
  const bob = interpolate(frame % 60, [0, 30, 60], [0, -6, 0]);

  // Blink animation (every ~3 seconds)
  const blinkCycle = frame % 90;
  const isBlinking = blinkCycle >= 85 && blinkCycle <= 89;

  // Eye expression
  const getEyes = () => {
    if (isBlinking) {
      return (
        <>
          <line x1="70" y1="105" x2="85" y2="105" stroke="#2C1810" strokeWidth="3" strokeLinecap="round" />
          <line x1="115" y1="105" x2="130" y2="105" stroke="#2C1810" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    }

    switch (expr) {
      case "shocked":
        return (
          <>
            <circle cx="78" cy="105" r="10" fill="white" stroke="#2C1810" strokeWidth="2" />
            <circle cx="78" cy="105" r="5" fill="#2C1810" />
            <circle cx="122" cy="105" r="10" fill="white" stroke="#2C1810" strokeWidth="2" />
            <circle cx="122" cy="105" r="5" fill="#2C1810" />
          </>
        );
      case "sad":
        return (
          <>
            <ellipse cx="78" cy="106" rx="8" ry="9" fill="white" stroke="#2C1810" strokeWidth="2" />
            <circle cx="78" cy="108" r="4" fill="#2C1810" />
            <ellipse cx="122" cy="106" rx="8" ry="9" fill="white" stroke="#2C1810" strokeWidth="2" />
            <circle cx="122" cy="108" r="4" fill="#2C1810" />
            {/* Sad eyebrows */}
            <line x1="66" y1="90" x2="88" y2="94" stroke="#2C1810" strokeWidth="3" strokeLinecap="round" />
            <line x1="134" y1="90" x2="112" y2="94" stroke="#2C1810" strokeWidth="3" strokeLinecap="round" />
          </>
        );
      case "angry":
        return (
          <>
            <ellipse cx="78" cy="106" rx="7" ry="8" fill="white" stroke="#2C1810" strokeWidth="2" />
            <circle cx="78" cy="106" r="4" fill="#2C1810" />
            <ellipse cx="122" cy="106" rx="7" ry="8" fill="white" stroke="#2C1810" strokeWidth="2" />
            <circle cx="122" cy="106" r="4" fill="#2C1810" />
            {/* Angry eyebrows */}
            <line x1="66" y1="94" x2="88" y2="88" stroke="#2C1810" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="134" y1="94" x2="112" y2="88" stroke="#2C1810" strokeWidth="3.5" strokeLinecap="round" />
          </>
        );
      default: // happy
        return (
          <>
            <ellipse cx="78" cy="105" rx="7" ry="8" fill="white" stroke="#2C1810" strokeWidth="2" />
            <circle cx="79" cy="105" r="4" fill="#2C1810" />
            <circle cx="81" cy="103" r="1.5" fill="white" />
            <ellipse cx="122" cy="105" rx="7" ry="8" fill="white" stroke="#2C1810" strokeWidth="2" />
            <circle cx="123" cy="105" r="4" fill="#2C1810" />
            <circle cx="125" cy="103" r="1.5" fill="white" />
          </>
        );
    }
  };

  // Mouth expression
  const getMouth = () => {
    switch (expr) {
      case "shocked":
        return <ellipse cx="100" cy="135" rx="10" ry="12" fill="#C0392B" stroke="#2C1810" strokeWidth="2" />;
      case "sad":
        return <path d="M 82 138 Q 100 128 118 138" fill="none" stroke="#2C1810" strokeWidth="3" strokeLinecap="round" />;
      case "angry":
        return <path d="M 85 133 L 100 138 L 115 133" fill="none" stroke="#2C1810" strokeWidth="3" strokeLinecap="round" />;
      default: // happy
        return (
          <>
            <path d="M 82 130 Q 100 148 118 130" fill="#C0392B" stroke="#2C1810" strokeWidth="2" />
            <path d="M 82 130 Q 100 136 118 130" fill="white" />
          </>
        );
    }
  };

  // Accessory rendering
  const getAccessory = () => {
    switch (char.accessory) {
      case "glasses":
        return (
          <>
            <circle cx="78" cy="105" r="16" fill="none" stroke="#333" strokeWidth="3" />
            <circle cx="122" cy="105" r="16" fill="none" stroke="#333" strokeWidth="3" />
            <line x1="94" y1="105" x2="106" y2="105" stroke="#333" strokeWidth="3" />
            <line x1="62" y1="100" x2="52" y2="95" stroke="#333" strokeWidth="2.5" />
            <line x1="138" y1="100" x2="148" y2="95" stroke="#333" strokeWidth="2.5" />
          </>
        );
      case "headband":
        return (
          <path d="M 50 78 Q 100 65 150 78" fill="none" stroke={char.color} strokeWidth="8" strokeLinecap="round" />
        );
      case "earring":
        return (
          <>
            <circle cx="52" cy="118" r="5" fill={char.color} />
            <circle cx="52" cy="126" r="3" fill={char.color} opacity="0.7" />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        transform: `scale(${entrySpring}) translateY(${bob}px)`,
        willChange: "transform",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Character SVG */}
      <svg width={size} height={size} viewBox="0 0 200 200">
        {/* Shadow */}
        <ellipse cx="100" cy="190" rx="50" ry="8" fill="rgba(0,0,0,0.15)" />

        {/* Body */}
        <ellipse cx="100" cy="178" rx="42" ry="22" fill={char.color} />
        
        {/* Neck */}
        <rect x="90" y="150" width="20" height="20" rx="5" fill={char.skinTone} />

        {/* Head */}
        <ellipse cx="100" cy="105" rx="55" ry="58" fill={char.skinTone} />

        {/* Hair */}
        <ellipse cx="100" cy="68" rx="55" ry="35" fill={char.hairColor} />
        <ellipse cx="55" cy="90" rx="12" ry="25" fill={char.hairColor} />
        <ellipse cx="145" cy="90" rx="12" ry="25" fill={char.hairColor} />

        {/* Ears */}
        <ellipse cx="48" cy="110" rx="10" ry="14" fill={char.skinTone} />
        <ellipse cx="152" cy="110" rx="10" ry="14" fill={char.skinTone} />

        {/* Blush */}
        <ellipse cx="65" cy="125" rx="12" ry="7" fill="#FFB5B5" opacity="0.5" />
        <ellipse cx="135" cy="125" rx="12" ry="7" fill="#FFB5B5" opacity="0.5" />

        {/* Eyes */}
        {getEyes()}

        {/* Nose */}
        <ellipse cx="100" cy="118" rx="4" ry="5" fill={char.skinTone} stroke="#E8C39E" strokeWidth="1" />

        {/* Mouth */}
        {getMouth()}

        {/* Accessory */}
        {getAccessory()}
      </svg>

      {/* Name label */}
      <div
        style={{
          background: char.color,
          borderRadius: 20,
          padding: "6px 24px",
          boxShadow: `0 4px 15px ${char.color}66`,
        }}
      >
        <span
          style={{
            fontSize: 26,
            fontFamily: "'Be Vietnam Pro', sans-serif",
            fontWeight: 700,
            color: "white",
          }}
        >
          {char.name}
        </span>
      </div>
    </div>
  );
};
