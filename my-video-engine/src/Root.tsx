import "./index.css";
import { Composition } from "remotion";
import { VideoComposition, getVideoDuration } from "./VideoComposition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="VideoComposition"
        component={VideoComposition}
        durationInFrames={getVideoDuration()}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
