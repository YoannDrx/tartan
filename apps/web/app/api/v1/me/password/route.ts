import { changePasswordInput, setPasswordInput } from "@tartan/contracts";
import { authRoute } from "@/lib/zod-route";
import { changePassword, definePassword } from "@/server/credentials.service";

// Définir un mot de passe sur un compte qui n'en a pas. 409 password_already_set s'il en a un ; `confirmation_sent`
// quand la session n'est pas assez récente : un lien part par e-mail et rien n'est enregistré.
export const POST = authRoute
  .body(setPasswordInput)
  .handler(async (request, { ctx, body }) => definePassword(ctx.actor, body, request.headers));

// Changer le mot de passe : l'actuel est exigé. 400 invalid_current_password, 409 no_password, 429 au-delà de cinq
// essais en dix minutes.
export const PATCH = authRoute.body(changePasswordInput).handler(async (request, { ctx, body }) => {
  await changePassword(ctx.actor, body, request.headers);
  return { ok: true as const };
});
