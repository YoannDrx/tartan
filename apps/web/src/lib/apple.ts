import { importPKCS8, SignJWT } from "jose";
import { env } from "./env";

export const appleClientSecret = async (): Promise<string> => {
  const e = env();
  const key = await importPKCS8((e.APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"), "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: e.APPLE_KEY_ID ?? "" })
    .setIssuer(e.APPLE_TEAM_ID ?? "")
    .setSubject(e.APPLE_CLIENT_ID ?? "")
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 180 * 24 * 60 * 60)
    .sign(key);
};

// Révoque les jetons Apple à la suppression du compte (§ 15.4).
export const revokeAppleToken = async (refreshToken: string): Promise<void> => {
  const e = env();
  if (!e.APPLE_CLIENT_ID || !e.APPLE_PRIVATE_KEY) return;
  await fetch("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: e.APPLE_CLIENT_ID,
      client_secret: await appleClientSecret(),
      token: refreshToken,
      token_type_hint: "refresh_token",
    }),
  });
};
