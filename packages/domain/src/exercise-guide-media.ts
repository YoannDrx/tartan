import type { ExerciseGuide } from "@tartan/contracts";

export const guideMediaModes = (
  guide: ExerciseGuide,
  hasMotion: boolean,
  hasPhoto = Boolean(guide.illustration.photo),
) => {
  const modes: ("motion" | "photo" | "video")[] = [];
  if (hasMotion) modes.push("motion");
  if (hasPhoto) modes.push("photo");
  if (guide.illustration.videos?.length) modes.push("video");
  return modes;
};
