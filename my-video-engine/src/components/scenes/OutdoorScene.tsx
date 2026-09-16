import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

/**
 * Animated outdoor scene with sky, clouds, hills, trees, flowers, and birds.
 */
export const OutdoorScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Cloud drift
  const cloud1X = interpolate(frame, [0, 600], [-200, 1300]) % 1400 - 200;
  const cloud2X = interpolate(frame, [0, 800], [1200, -300]) % 1500;
  const cloud3X = interpolate(frame, [0, 700], [-100, 1200]) % 1400 - 100;

  // Sun rays rotation
  const sunRayAngle = interpolate(frame, [0, 360], [0, 30]);

  // Grass/flower sway
  const sway = interpolate(frame % 120, [0, 60, 120], [-3, 3, -3]);

  // Bird flight
  const birdX = interpolate(frame % 300, [0, 300], [-50, 1130]);
  const birdY = 200 + Math.sin(frame * 0.05) * 30;
  const wingAngle = interpolate(frame % 20, [0, 10, 20], [-15, 15, -15]);

  // Butterfly
  const butterflyX = 300 + Math.sin(frame * 0.03) * 100;
  const butterflyY = 900 + Math.cos(frame * 0.04) * 50;
  const butterflyWing = interpolate(frame % 12, [0, 6, 12], [0.3, 1, 0.3]);

  return (
    <AbsoluteFill>
      <svg width="1080" height="1920" viewBox="0 0 1080 1920">
        <defs>
          <linearGradient id="skyGradOut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4DA6FF" />
            <stop offset="40%" stopColor="#87CEEB" />
            <stop offset="70%" stopColor="#B8E6FF" />
            <stop offset="100%" stopColor="#E0F4FF" />
          </linearGradient>
          <linearGradient id="grassGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4CAF50" />
            <stop offset="100%" stopColor="#2E7D32" />
          </linearGradient>
          <linearGradient id="hillGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#66BB6A" />
            <stop offset="100%" stopColor="#43A047" />
          </linearGradient>
          <linearGradient id="hillGrad2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#81C784" />
            <stop offset="100%" stopColor="#4CAF50" />
          </linearGradient>
          <radialGradient id="sunGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF9C4" />
            <stop offset="60%" stopColor="#FFD54F" />
            <stop offset="100%" stopColor="#FFB300" />
          </radialGradient>
        </defs>

        {/* Sky */}
        <rect width="1080" height="1920" fill="url(#skyGradOut)" />

        {/* Sun */}
        <g transform={`rotate(${sunRayAngle}, 900, 180)`}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
            <line
              key={`ray-${i}`}
              x1="900" y1="180"
              x2={900 + Math.cos(i * 30 * Math.PI / 180) * 130}
              y2={180 + Math.sin(i * 30 * Math.PI / 180) * 130}
              stroke="#FFD54F" strokeWidth="3" opacity="0.3"
            />
          ))}
        </g>
        <circle cx="900" cy="180" r="70" fill="url(#sunGrad)" />
        <circle cx="900" cy="180" r="85" fill="none" stroke="#FFD54F" strokeWidth="2" opacity="0.2" />

        {/* Clouds */}
        <g transform={`translate(${cloud1X}, 120)`} opacity="0.9">
          <ellipse cx="60" cy="30" rx="60" ry="25" fill="white" />
          <ellipse cx="100" cy="20" rx="45" ry="22" fill="white" />
          <ellipse cx="30" cy="22" rx="35" ry="18" fill="white" />
        </g>
        <g transform={`translate(${cloud2X}, 250)`} opacity="0.7">
          <ellipse cx="50" cy="25" rx="50" ry="20" fill="white" />
          <ellipse cx="90" cy="18" rx="40" ry="18" fill="white" />
          <ellipse cx="20" cy="20" rx="30" ry="15" fill="white" />
        </g>
        <g transform={`translate(${cloud3X}, 380)`} opacity="0.5">
          <ellipse cx="40" cy="20" rx="40" ry="16" fill="white" />
          <ellipse cx="70" cy="14" rx="30" ry="14" fill="white" />
        </g>

        {/* Bird */}
        <g transform={`translate(${birdX}, ${birdY})`}>
          <path d={`M 0 0 Q -12 ${wingAngle} -25 ${wingAngle * 0.5}`} fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" />
          <path d={`M 0 0 Q 12 ${wingAngle} 25 ${wingAngle * 0.5}`} fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" />
        </g>

        {/* Far hills */}
        <ellipse cx="200" cy="850" rx="400" ry="180" fill="url(#hillGrad2)" opacity="0.6" />
        <ellipse cx="800" cy="880" rx="500" ry="200" fill="url(#hillGrad2)" opacity="0.5" />

        {/* Near hills */}
        <ellipse cx="540" cy="950" rx="700" ry="200" fill="url(#hillGrad1)" />

        {/* Grass ground */}
        <rect x="0" y="950" width="1080" height="970" fill="url(#grassGrad)" />

        {/* Path/road */}
        <path d="M 400 1920 Q 500 1400 540 1050" fill="none" stroke="#D4A574" strokeWidth="80" opacity="0.5" />
        <path d="M 400 1920 Q 500 1400 540 1050" fill="none" stroke="#C49564" strokeWidth="60" opacity="0.3" />

        {/* === TREES === */}
        {/* Big tree left */}
        <rect x="60" y="750" width="40" height="250" rx="5" fill="#795548" />
        <rect x="55" y="750" width="50" height="20" rx="5" fill="#6D4C41" />
        <g transform={`rotate(${sway * 0.3}, 80, 750)`}>
          <ellipse cx="80" cy="680" rx="110" ry="100" fill="#388E3C" />
          <ellipse cx="40" cy="720" rx="70" ry="60" fill="#43A047" />
          <ellipse cx="130" cy="710" rx="60" ry="55" fill="#2E7D32" />
          <ellipse cx="80" cy="640" rx="60" ry="50" fill="#4CAF50" />
        </g>

        {/* Medium tree right */}
        <rect x="920" y="820" width="30" height="180" rx="4" fill="#795548" />
        <g transform={`rotate(${sway * 0.4}, 935, 820)`}>
          <ellipse cx="935" cy="760" rx="80" ry="75" fill="#388E3C" />
          <ellipse cx="900" cy="790" rx="55" ry="45" fill="#43A047" />
          <ellipse cx="970" cy="780" rx="50" ry="45" fill="#2E7D32" />
        </g>

        {/* Small tree middle-far */}
        <rect x="500" y="870" width="20" height="100" rx="3" fill="#8D6E63" />
        <g transform={`rotate(${sway * 0.5}, 510, 870)`}>
          <ellipse cx="510" cy="830" rx="50" ry="50" fill="#66BB6A" />
          <ellipse cx="490" cy="850" rx="35" ry="30" fill="#4CAF50" />
        </g>

        {/* Bushes */}
        <ellipse cx="200" cy="1020" rx="60" ry="35" fill="#388E3C" opacity="0.8" />
        <ellipse cx="250" cy="1030" rx="40" ry="25" fill="#43A047" opacity="0.7" />
        <ellipse cx="850" cy="1000" rx="50" ry="30" fill="#2E7D32" opacity="0.8" />

        {/* === FLOWERS === */}
        {[150, 300, 700, 850, 950].map((x, i) => {
          const flowerY = 1020 + (i % 3) * 30;
          const colors = ["#FF6B9D", "#FFD54F", "#E040FB", "#FF5252", "#FF9800"];
          return (
            <g key={`flower-${i}`} transform={`rotate(${sway * 0.5}, ${x}, ${flowerY})`}>
              <line x1={x} y1={flowerY} x2={x} y2={flowerY + 30} stroke="#4CAF50" strokeWidth="2" />
              <circle cx={x} cy={flowerY} r="8" fill={colors[i]} />
              <circle cx={x} cy={flowerY} r="3" fill="#FFD54F" />
            </g>
          );
        })}

        {/* Butterfly */}
        <g transform={`translate(${butterflyX}, ${butterflyY})`}>
          <ellipse cx="-8" cy="0" rx="8" ry="5" fill="#E040FB" opacity="0.8" transform={`scale(${butterflyWing}, 1)`} />
          <ellipse cx="8" cy="0" rx="8" ry="5" fill="#E040FB" opacity="0.8" transform={`scale(${butterflyWing}, 1)`} />
          <ellipse cx="0" cy="0" rx="2" ry="5" fill="#4A148C" />
        </g>

        {/* Grass tufts foreground */}
        {[50, 180, 350, 580, 750, 900, 1020].map((x, i) => (
          <g key={`grass-${i}`} transform={`rotate(${sway * (0.3 + i * 0.1)}, ${x}, 1920)`}>
            <path d={`M ${x} 1920 Q ${x - 5} 1890 ${x - 8} 1870`} fill="none" stroke="#2E7D32" strokeWidth="3" />
            <path d={`M ${x + 8} 1920 Q ${x + 3} 1885 ${x} 1860`} fill="none" stroke="#388E3C" strokeWidth="2.5" />
            <path d={`M ${x + 15} 1920 Q ${x + 12} 1895 ${x + 10} 1880`} fill="none" stroke="#43A047" strokeWidth="2" />
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );
};
