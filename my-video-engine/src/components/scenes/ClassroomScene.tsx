import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

/**
 * Animated classroom background with chalkboard, desks, windows, clock.
 */
export const ClassroomScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Clock hands rotation
  const minuteAngle = interpolate(frame, [0, 1800], [0, 360]);
  const hourAngle = minuteAngle / 12;

  // Sunlight shimmer through window
  const sunOpacity = interpolate(frame % 90, [0, 45, 90], [0.08, 0.18, 0.08]);

  // Subtle chalk dust particles
  const dustY1 = interpolate(frame % 200, [0, 200], [280, 180]);
  const dustY2 = interpolate(frame % 160, [0, 160], [300, 200]);
  const dustOpacity = interpolate(frame % 200, [0, 100, 200], [0, 0.6, 0]);

  return (
    <AbsoluteFill>
      <svg width="1080" height="1920" viewBox="0 0 1080 1920">
        {/* Wall */}
        <rect width="1080" height="1920" fill="#FFF5E6" />
        <rect width="1080" height="1920" fill="url(#wallTexture)" opacity="0.3" />

        <defs>
          <pattern id="wallTexture" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="none" />
            <line x1="0" y1="0" x2="40" y2="0" stroke="#E8D5B8" strokeWidth="0.5" />
            <line x1="0" y1="20" x2="40" y2="20" stroke="#E8D5B8" strokeWidth="0.3" />
          </pattern>
          <linearGradient id="chalkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2D5016" />
            <stop offset="100%" stopColor="#1A3A0A" />
          </linearGradient>
          <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C4956A" />
            <stop offset="100%" stopColor="#A07850" />
          </linearGradient>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#87CEEB" />
            <stop offset="100%" stopColor="#B8E6FF" />
          </linearGradient>
        </defs>

        {/* Floor */}
        <rect x="0" y="1400" width="1080" height="520" fill="url(#floorGrad)" />
        {/* Floor lines */}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <line key={`fl-${i}`} x1="0" y1={1400 + i * 75} x2="1080" y2={1400 + i * 75} stroke="#B8885E" strokeWidth="1" opacity="0.4" />
        ))}

        {/* Wainscoting / lower wall */}
        <rect x="0" y="1300" width="1080" height="100" fill="#D4A574" />
        <line x1="0" y1="1300" x2="1080" y2="1300" stroke="#C49564" strokeWidth="3" />

        {/* === CHALKBOARD === */}
        <rect x="140" y="250" width="800" height="450" rx="5" fill="#5C3A1E" />
        <rect x="160" y="270" width="760" height="410" rx="3" fill="url(#chalkGrad)" />
        {/* Chalk tray */}
        <rect x="180" y="680" width="720" height="25" rx="3" fill="#7A5230" />
        <rect x="180" y="683" width="720" height="8" rx="2" fill="#6B4525" />
        {/* Chalk pieces */}
        <rect x="420" y="673" width="40" height="10" rx="2" fill="#FFFFFF" opacity="0.9" />
        <rect x="480" y="675" width="30" height="8" rx="2" fill="#FFE066" opacity="0.8" />
        <rect x="530" y="674" width="35" height="9" rx="2" fill="#FF9999" opacity="0.8" />

        {/* Chalk text on board */}
        <text x="540" y="420" textAnchor="middle" fill="#D4E8C0" fontSize="48" fontFamily="serif" opacity="0.7" fontStyle="italic">
          Bài học hôm nay
        </text>
        <line x1="320" y1="440" x2="760" y2="440" stroke="#D4E8C0" strokeWidth="1.5" opacity="0.4" />

        {/* Chalk dust particles */}
        <circle cx="450" cy={dustY1} r="2" fill="#FFFFFF" opacity={dustOpacity * 0.5} />
        <circle cx="520" cy={dustY2} r="1.5" fill="#FFFFCC" opacity={dustOpacity * 0.4} />
        <circle cx="600" cy={dustY1 + 30} r="1.8" fill="#FFFFFF" opacity={dustOpacity * 0.3} />

        {/* === WINDOWS (left) === */}
        <rect x="30" y="280" width="80" height="200" rx="4" fill="#8B7355" />
        <rect x="36" y="286" width="68" height="90" rx="2" fill="url(#skyGrad)" />
        <rect x="36" y="382" width="68" height="90" rx="2" fill="url(#skyGrad)" />
        <line x1="70" y1="286" x2="70" y2="376" stroke="#8B7355" strokeWidth="3" />
        <line x1="70" y1="382" x2="70" y2="472" stroke="#8B7355" strokeWidth="3" />
        {/* Sunlight beam */}
        <polygon points="104,286 300,500 200,500 36,286" fill="#FFF8DC" opacity={sunOpacity} />

        {/* === WINDOWS (right) === */}
        <rect x="970" y="280" width="80" height="200" rx="4" fill="#8B7355" />
        <rect x="976" y="286" width="68" height="90" rx="2" fill="url(#skyGrad)" />
        <rect x="976" y="382" width="68" height="90" rx="2" fill="url(#skyGrad)" />
        <line x1="1010" y1="286" x2="1010" y2="376" stroke="#8B7355" strokeWidth="3" />

        {/* === CLOCK === */}
        <circle cx="950" y="180" r="45" fill="#FFFFFF" stroke="#5C3A1E" strokeWidth="4" />
        <circle cx="950" cy="180" r="3" fill="#333" />
        {/* Hour marks */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
          <line
            key={`mark-${i}`}
            x1={950 + Math.cos((i * 30 - 90) * Math.PI / 180) * 35}
            y1={180 + Math.sin((i * 30 - 90) * Math.PI / 180) * 35}
            x2={950 + Math.cos((i * 30 - 90) * Math.PI / 180) * 40}
            y2={180 + Math.sin((i * 30 - 90) * Math.PI / 180) * 40}
            stroke="#333"
            strokeWidth={i % 3 === 0 ? 3 : 1.5}
          />
        ))}
        {/* Minute hand */}
        <line
          x1="950" y1="180"
          x2={950 + Math.cos((minuteAngle - 90) * Math.PI / 180) * 32}
          y2={180 + Math.sin((minuteAngle - 90) * Math.PI / 180) * 32}
          stroke="#333" strokeWidth="2" strokeLinecap="round"
        />
        {/* Hour hand */}
        <line
          x1="950" y1="180"
          x2={950 + Math.cos((hourAngle - 90) * Math.PI / 180) * 22}
          y2={180 + Math.sin((hourAngle - 90) * Math.PI / 180) * 22}
          stroke="#333" strokeWidth="3" strokeLinecap="round"
        />

        {/* === DESKS (foreground) === */}
        {/* Desk row - bottom */}
        <rect x="80" y="1480" width="250" height="15" rx="3" fill="#C4956A" />
        <rect x="85" y="1495" width="8" height="80" fill="#A07850" />
        <rect x="317" y="1495" width="8" height="80" fill="#A07850" />
        
        <rect x="420" y="1480" width="250" height="15" rx="3" fill="#C4956A" />
        <rect x="425" y="1495" width="8" height="80" fill="#A07850" />
        <rect x="657" y="1495" width="8" height="80" fill="#A07850" />

        <rect x="760" y="1480" width="250" height="15" rx="3" fill="#C4956A" />
        <rect x="765" y="1495" width="8" height="80" fill="#A07850" />
        <rect x="997" y="1495" width="8" height="80" fill="#A07850" />

        {/* Books on desk */}
        <rect x="130" y="1468" width="50" height="12" rx="2" fill="#4A90FF" />
        <rect x="135" y="1460" width="40" height="8" rx="1" fill="#FF6B9D" />
        <rect x="500" y="1470" width="45" height="10" rx="2" fill="#4ECDC4" />

        {/* === DECORATIONS === */}
        {/* Poster on wall */}
        <rect x="30" y="550" width="90" height="120" rx="3" fill="#FFE4B5" stroke="#DEB887" strokeWidth="1" />
        <text x="75" y="610" textAnchor="middle" fill="#8B4513" fontSize="14" fontFamily="sans-serif">ABC</text>
        <text x="75" y="640" textAnchor="middle" fill="#8B4513" fontSize="11" fontFamily="sans-serif">123</text>

        {/* Light fixture */}
        <rect x="440" y="0" width="200" height="8" rx="2" fill="#999" />
        <rect x="490" y="8" width="100" height="30" rx="5" fill="#FFF8DC" opacity="0.9" />
        <ellipse cx="540" cy="50" rx="120" ry="30" fill="#FFFFF0" opacity="0.06" />
      </svg>
    </AbsoluteFill>
  );
};
