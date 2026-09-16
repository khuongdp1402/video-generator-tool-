import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useVideoConfig,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { HeadlineScene } from "./templates/HeadlineScene";
import { BulletScene } from "./templates/BulletScene";
import { OutroScene } from "./templates/OutroScene";
import { DialogueScene } from "./templates/DialogueScene";
import { StoryScene } from "./templates/StoryScene";
import { WhiteboardScene } from "./templates/WhiteboardScene";
import { MediaScene } from "./components/MediaScene";
import { VideoData, ThemeColors, THEMES } from "./types";
import videoData from "./data/video_data.json";

const data = videoData as VideoData;

/**
 * Main video composition that assembles all scenes sequentially.
 * Reads video_data.json, maps each scene to its template,
 * and overlays background music.
 */
export const VideoComposition: React.FC = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const themeColors = THEMES[data.meta.theme] || THEMES["dark-cyan"];

  // Calculate cumulative frame offsets for each scene
  const sceneOffsets: number[] = [];
  let cumulative = 0;
  for (const scene of data.scenes) {
    sceneOffsets.push(cumulative);
    cumulative += scene.durationInFrames;
  }

  // Music fade out in last 2 seconds
  const totalDuration = cumulative;
  const musicFadeStart = totalDuration - fps * 2;
  const musicVolume = interpolate(
    frame,
    [0, 10, musicFadeStart, totalDuration],
    [0, data.meta.musicVolume, data.meta.musicVolume, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: themeColors.bg1,
        fontFamily: "'Be Vietnam Pro', 'Montserrat', sans-serif",
      }}
    >
      {/* Render each scene as a Sequence */}
      {data.scenes.map((scene, index) => {
        const from = sceneOffsets[index];

        return (
          <Sequence
            key={scene.id}
            from={from}
            durationInFrames={scene.durationInFrames}
            name={`Scene ${scene.id}: ${scene.type}`}
          >
            {renderScene(scene, themeColors)}
          </Sequence>
        );
      })}

      {/* Background music overlay (spans entire video) */}
      {data.meta.bgMusic && (
        <Audio
          src={staticFile(`musics/${data.meta.bgMusic}`)}
          volume={musicVolume}
          loop
        />
      )}
    </AbsoluteFill>
  );
};

/**
 * Maps a scene to its corresponding template component.
 */
function renderScene(scene: VideoData["scenes"][0], themeColors: ThemeColors) {
  switch (scene.type) {
    case "headline":
      return <HeadlineScene scene={scene} theme={themeColors} />;
    case "bullet_points":
    case "tip":
      return <BulletScene scene={scene} theme={themeColors} />;
    case "dialogue":
      return <DialogueScene scene={scene} theme={themeColors} />;
    case "story":
      return <StoryScene scene={scene} theme={themeColors} />;
    case "whiteboard":
      return <WhiteboardScene scene={scene} theme={themeColors} />;
    case "outro":
      return <OutroScene scene={scene} theme={themeColors} />;
    case "media":
      return <MediaScene scene={scene} theme={themeColors} />;
    default:
      return <HeadlineScene scene={scene} theme={themeColors} />;
  }
}

/**
 * Calculate total duration from all scenes.
 * Used by Remotion's calculateMetadata.
 */
export function getVideoDuration(): number {
  return data.scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
}
