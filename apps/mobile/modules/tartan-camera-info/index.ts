import { requireOptionalNativeModule } from "expo";

type CameraInfoModule = { frameRates(): number[] };

const native = requireOptionalNativeModule<CameraInfoModule>("TartanCameraInfo");

// Fréquences d'images que la caméra arrière sait filmer. Liste vide si l'information manque
// (simulateur, ancien téléphone, module absent) : l'interface le dit au lieu d'inventer.
export const availableFrameRates = (): number[] => {
  try {
    return [...(native?.frameRates() ?? [])].sort((a, b) => a - b);
  } catch {
    return [];
  }
};
