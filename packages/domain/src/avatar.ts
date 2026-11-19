import { avatarPreset, type AvatarPreset } from "@tartan/contracts";

const firstLetter = (word: string) => [...word.replace(/^[^\p{L}\p{N}]+/u, "")][0] ?? "";
const words = (text: string | null | undefined) =>
  (text ?? "")
    .trim()
    .split(/[\s-]+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word));

// Les initiales d'une personne : la première lettre du prénom et du nom, ou des deux premiers mots d'un nom
// complet. Les accents sont gardés (« Élodie Ébène » donne « ÉÉ ») ; un nom vide donne une chaîne vide.
export const initialsOf = (first?: string | null, last?: string | null): string => {
  const [firstWords, lastWords] = [words(first), words(last)];
  const picked =
    firstWords.length > 0 && lastWords.length > 0
      ? [firstWords[0]!, lastWords[0]!]
      : [...firstWords, ...lastWords].slice(0, 2);
  return picked.map(firstLetter).join("").toLocaleUpperCase("fr-FR");
};

// Une valeur lue en base ou reçue d'un client plus récent : seul un avatar connu est dessiné.
export const knownAvatarPreset = (value: string | null | undefined): AvatarPreset | null => {
  const parsed = avatarPreset.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export type AvatarSource =
  { kind: "photo"; url: string } | { kind: "preset"; preset: AvatarPreset } | { kind: "initials"; initials: string };

// Ce qui s'affiche : la photo, sinon l'avatar choisi, sinon les initiales.
export const avatarSource = (person: {
  avatarUrl?: string | null;
  avatarPreset?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): AvatarSource => {
  if (person.avatarUrl) return { kind: "photo", url: person.avatarUrl };
  const preset = knownAvatarPreset(person.avatarPreset);
  if (preset) return { kind: "preset", preset };
  return { kind: "initials", initials: initialsOf(person.firstName, person.lastName) };
};
