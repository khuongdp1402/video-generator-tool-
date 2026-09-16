import "./index.css";
import { Composition } from "remotion";
import { VideoComposition, getVideoDuration } from "./VideoComposition";
import videoData from "./data/video_data.json";
import { VideoData } from "./types";

const DIMENSIONS_BY_ASPECT_RATIO: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VideoComposition"
        component={VideoComposition}
        durationInFrames={getVideoDuration()}
        fps={30}
        width={1280}
        height={720}
        calculateMetadata={async () => {
          const data = videoData as VideoData;
          const dims = DIMENSIONS_BY_ASPECT_RATIO[data.meta.aspectRatio || "16:9"];
          return { width: dims.width, height: dims.height };
        }}
      />
    </>
  );
};
