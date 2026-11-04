import { m } from "@tartan/i18n";
import { Share } from "react-native";
import { api } from "./api";

// Remet à la personne tout ce que Tartan garde d'elle, là où elle choisit de l'enregistrer.
export const shareMyData = async (): Promise<void> => {
  const data = await api.exportMyData();
  await Share.share({ title: m.settings.exportData, message: JSON.stringify(data, null, 2) });
};
