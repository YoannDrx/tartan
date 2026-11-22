import * as ImagePicker from "expo-image-picker";
import { loadImage } from "react-native-nitro-image";
import { api } from "./api";
import { AVATAR_QUALITY, fileUri, planSquare } from "./avatar-photo";

// Choisir une photo, la recadrer en carré avec l'éditeur du téléphone (déplacer, zoomer), la réduire puis l'envoyer.
// Aucune dépendance ajoutée : le recadrage est celui d'`expo-image-picker`, la réduction celle de
// `react-native-nitro-image`, déjà embarqués. Rien de l'image n'est journalisé.

export type PickOutcome =
  { kind: "picked"; uri: string } | { kind: "cancelled" } | { kind: "denied" } | { kind: "unreadable" };

const PICKER: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 1,
  exif: false,
};

export const pickAvatarPhoto = async (from: "library" | "camera"): Promise<PickOutcome> => {
  // Le sélecteur de photos du système ne demande aucun accès à la pellicule : seule la caméra en demande un.
  if (from === "camera" && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return { kind: "denied" };
  try {
    const result =
      from === "camera"
        ? await ImagePicker.launchCameraAsync(PICKER)
        : await ImagePicker.launchImageLibraryAsync(PICKER);
    if (result.canceled) return { kind: "cancelled" };
    const asset = result.assets[0];
    if (!asset) return { kind: "unreadable" };
    const image = await loadImage({ filePath: asset.uri });
    const plan = planSquare(image.width, image.height);
    if (!plan) return { kind: "unreadable" };
    const square = plan.crop
      ? await image.cropAsync(plan.crop.startX, plan.crop.startY, plan.crop.endX, plan.crop.endY)
      : image;
    const sized = plan.resizeTo ? await square.resizeAsync(plan.resizeTo, plan.resizeTo) : square;
    const path = await sized.saveToTemporaryFileAsync("jpg", AVATAR_QUALITY);
    return { kind: "picked", uri: fileUri(path) };
  } catch {
    return { kind: "unreadable" };
  }
};

export const uploadAvatarPhoto = (uri: string) => {
  const form = new FormData();
  // Le `fetch` de React Native lit le fichier lui-même à partir de son chemin.
  form.append("file", { uri, name: "avatar.jpg", type: "image/jpeg" } as unknown as Blob);
  return api.uploadAvatar(form);
};
