import type { ExerciseGuide } from "@tartan/contracts";

export const guideMediaModes = (
  guide: ExerciseGuide,
  hasMotion: boolean,
  hasPhoto = Boolean(guide.illustration.photo),
) => {
  const modes: ("motion" | "photo" | "video")[] = [];
  if (guide.illustration.videos?.some((video) => video.streamUrl)) {
    modes.push("video");
    return modes;
  }
  if (hasMotion) modes.push("motion");
  if (hasPhoto) modes.push("photo");
  return modes;
};
