import { createSign } from "node:crypto";
import { compareVersions, publishedPlayVersions, servedPlayVersion } from "@tartan/domain";
import { z } from "zod";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const TRACK = "production";
const TIMEOUT_MS = 8000;

const serviceAccount = z.object({ client_email: z.string().min(1), private_key: z.string().min(1) });
const tokenResponse = z.object({ access_token: z.string().min(1) });
const releasesResponse = z.object({
  releases: z
    .array(z.object({ releaseName: z.string().optional(), releaseLifecycleState: z.string().optional() }))
    .default([]),
});
const editResponse = z.object({ id: z.string().min(1) });
const trackResponse = z.object({
  releases: z.array(z.object({ name: z.string().optional(), status: z.string().optional() })).default([]),
});

// Le code d'erreur reste la seule trace d'un échec : jamais la clé, ni une réponse de Google.
class PlayLookupError extends Error {}

const base64Url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

// JWT du compte de service, RS256, une heure au plus (documentation OAuth 2.0 de Google).
const signAssertion = (account: z.infer<typeof serviceAccount>, now: Date): string => {
  const iat = Math.floor(now.getTime() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }),
  );
  const unsigned = `${header}.${claims}`;
  return `${unsigned}.${base64Url(createSign("RSA-SHA256").update(unsigned).sign(account.private_key))}`;
};

const readCredentials = (json: string, now: Date): string => {
  try {
    return signAssertion(serviceAccount.parse(JSON.parse(json)), now);
  } catch {
    throw new PlayLookupError("play_credentials_invalid");
  }
};

const jsonOf = async <T>(res: Response, schema: z.ZodType<T>, step: string): Promise<T> => {
  if (!res.ok) throw new PlayLookupError(`play_${step}_${res.status}`);
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) throw new PlayLookupError(`play_${step}_invalid`);
  return parsed.data;
};

export type PlayLookup = { version: string | null; errorCode: string | null };

// La version servie à tous sur la piste de production, ou rien.
// « completed » apparaît dès l'envoi, avant la fin de la revue : le cycle de vie de la sortie doit le confirmer.
export const readPlayProductionVersion = async (input: {
  packageName: string;
  credentialsJson: string;
  // Version la plus ancienne attendue : tant qu'aucune sortie publiée ne l'atteint, aucune édition n'est ouverte.
  wanted: string;
  now: Date;
  fetcher: typeof fetch;
}): Promise<PlayLookup> => {
  const { packageName, credentialsJson, wanted, now, fetcher } = input;
  const signal = () => AbortSignal.timeout(TIMEOUT_MS);
  const app = `${API}/${encodeURIComponent(packageName)}`;
  try {
    const assertion = readCredentials(credentialsJson, now);
    const { access_token: token } = await jsonOf(
      await fetcher(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
        signal: signal(),
        cache: "no-store",
      }),
      tokenResponse,
      "token",
    );
    const headers = { authorization: `Bearer ${token}` };

    const { releases } = await jsonOf(
      await fetcher(`${app}/tracks/${TRACK}/releases`, { headers, signal: signal(), cache: "no-store" }),
      releasesResponse,
      "releases",
    );
    const published = publishedPlayVersions(releases);
    if (published === null) return { version: null, errorCode: "play_version_unreadable" };
    if (!published.some((version) => compareVersions(version, wanted) >= 0)) return { version: null, errorCode: null };

    // Une édition ouverte remplace celle du même compte : on n'en ouvre que si une sortie publiée est candidate.
    const { id: editId } = await jsonOf(
      await fetcher(`${app}/edits`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: "{}",
        signal: signal(),
        cache: "no-store",
      }),
      editResponse,
      "edit",
    );
    const edit = `${app}/edits/${encodeURIComponent(editId)}`;
    try {
      const track = await jsonOf(
        await fetcher(`${edit}/tracks/${TRACK}`, { headers, signal: signal(), cache: "no-store" }),
        trackResponse,
        "track",
      );
      return { version: servedPlayVersion(published, track.releases), errorCode: null };
    } finally {
      // Lecture seule : l'édition n'est jamais validée, et son abandon ne doit pas masquer le résultat.
      await fetcher(edit, { method: "DELETE", headers, signal: signal(), cache: "no-store" }).catch(() => undefined);
    }
  } catch (error) {
    return { version: null, errorCode: error instanceof PlayLookupError ? error.message : "play_lookup_failed" };
  }
};
