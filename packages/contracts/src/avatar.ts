import { z } from "zod";

// Les avatars prédéfinis : les six athlètes du groupe, puis les animaux dessinés pour Tartan.
// Un identifiant se lit `famille:nom` ; le web et le mobile dessinent chacun le leur à partir de lui.
export const AVATAR_GROUP_IDS = ["hurdles", "poleVault", "tripleJump", "discus", "longJump", "highJump"] as const;
export const AVATAR_ANIMAL_IDS = [
  "fox",
  "cat",
  "dog",
  "bear",
  "rabbit",
  "owl",
  "panda",
  "lion",
  "frog",
  "penguin",
  "koala",
  "hedgehog",
] as const;

export type AvatarGroupId = (typeof AVATAR_GROUP_IDS)[number];
export type AvatarAnimalId = (typeof AVATAR_ANIMAL_IDS)[number];

export const AVATAR_PRESETS = [
  ...AVATAR_GROUP_IDS.map((id) => `athlete:${id}` as const),
  ...AVATAR_ANIMAL_IDS.map((id) => `animal:${id}` as const),
] as const;

export const avatarPreset = z.enum(AVATAR_PRESETS);
export type AvatarPreset = z.infer<typeof avatarPreset>;

// Ce qu'il faut pour dessiner l'avatar d'une personne : sa photo, sinon l'avatar choisi, sinon ses initiales.
export const avatarFields = {
  avatarUrl: z.string().nullable().optional(),
  avatarPreset: z.string().nullable().optional(),
};

export const avatarPresetInput = z.object({ preset: avatarPreset.nullable() });
export type AvatarPresetInput = z.infer<typeof avatarPresetInput>;
