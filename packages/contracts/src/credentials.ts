import { z } from "zod";

// Les moyens de connexion d'un compte : leur état, définir un mot de passe, le changer.
// Le web et le mobile partagent ces contrats (`/api/v1/me/sign-in-methods`, `/api/v1/me/password`).

// Mêmes bornes que la configuration du serveur d'authentification.
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Choisis un mot de passe d'au moins ${PASSWORD_MIN_LENGTH} caractères`)
  .max(PASSWORD_MAX_LENGTH, `Choisis un mot de passe de ${PASSWORD_MAX_LENGTH} caractères au plus`);

export const setPasswordInput = z.object({ newPassword });
export type SetPasswordInput = z.infer<typeof setPasswordInput>;

export const changePasswordInput = z.object({
  currentPassword: z.string().min(1, "Saisis ton mot de passe actuel").max(PASSWORD_MAX_LENGTH),
  newPassword,
  // Coupe les sessions ouvertes ailleurs ; l'appareil qui fait la demande reste connecté.
  revokeOtherSessions: z.boolean().optional(),
});
export type ChangePasswordInput = z.infer<typeof changePasswordInput>;

// `set` : le mot de passe est enregistré. `confirmation_sent` : la session n'est pas assez récente, un lien
// de confirmation vient de partir par e-mail ; le mot de passe n'est pas enregistré.
export const setPasswordResponse = z.object({ status: z.enum(["set", "confirmation_sent"]) });
export type SetPasswordResponse = z.infer<typeof setPasswordResponse>;

const socialMethod = z.object({
  // Le fournisseur est configuré sur ce serveur.
  available: z.boolean(),
  // Ce compte s'est déjà connecté avec lui.
  linked: z.boolean(),
});

export const signInMethodsResponse = z.object({
  email: z.string(),
  // Le lien reçu par e-mail marche pour tout compte.
  magicLink: z.literal(true),
  password: z.boolean(),
  // Sans mot de passe : la session est assez récente pour en définir un tout de suite. Sinon, `POST /me/password`
  // répond `confirmation_sent` et `POST /me/password/confirmation` envoie le lien sans rien demander d'autre.
  canSetPasswordNow: z.boolean(),
  google: socialMethod,
  apple: socialMethod,
  // La proposition « définir un mot de passe » de l'accueil est encore ouverte pour ce compte.
  passwordPrompt: z.boolean(),
});
export type SignInMethodsResponse = z.infer<typeof signInMethodsResponse>;
