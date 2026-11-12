import { decodeJwt, importPKCS8, SignJWT } from "jose";
import { env } from "./env";

// Le secret client d'Apple : un jeton signé par notre clé, pour le service web ou pour l'app iOS (son bundle).
export const appleClientSecret = async (clientId?: string): Promise<string> => {
  const e = env();
  const key = await importPKCS8((e.APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"), "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: e.APPLE_KEY_ID ?? "" })
    .setIssuer(e.APPLE_TEAM_ID ?? "")
    .setSubject(clientId ?? e.APPLE_CLIENT_ID ?? "")
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 180 * 24 * 60 * 60)
    .sign(key);
};

// Révoque les jetons Apple à la suppression du compte (§ 15.4), avec l'identifiant qui les a délivrés.
export const revokeAppleToken = async (refreshToken: string, clientId?: string | null): Promise<void> => {
  const e = env();
  const id = clientId ?? e.APPLE_CLIENT_ID;
  if (!id || !e.APPLE_PRIVATE_KEY) return;
  const response = await fetch("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id,
      client_secret: await appleClientSecret(id),
      token: refreshToken,
      token_type_hint: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error(`apple_revoke_${response.status}`);
};

// L'app iOS se connecte par un jeton d'identité, qui ne donne aucun jeton de rafraîchissement. Elle transmet aussi le
// code d'autorisation d'Apple : l'échanger donne ce jeton, seul moyen de révoquer l'accès plus tard. Le jeton
// d'identité vient d'Apple, en réponse directe à notre requête signée : son sujet suffit à vérifier le compte.
export const exchangeAppleCode = async (code: string): Promise<{ refreshToken: string; subject: string } | null> => {
  const e = env();
  const clientId = e.APPLE_APP_BUNDLE_IDENTIFIER;
  if (!clientId || !e.APPLE_PRIVATE_KEY) return null;
  const response = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: await appleClientSecret(clientId),
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new Error(`apple_token_${response.status}`);
  const body = (await response.json()) as { refresh_token?: string; id_token?: string };
  if (!body.refresh_token || !body.id_token) throw new Error("apple_token_invalid");
  return { refreshToken: body.refresh_token, subject: decodeJwt(body.id_token).sub ?? "" };
};
