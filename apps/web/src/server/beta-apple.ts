import { importPKCS8, SignJWT } from "jose";
import { z } from "zod";
import { env } from "@/lib/env";

const tester = z.object({ type: z.literal("betaTesters"), id: z.string().min(1) });

// Le groupe configuré doit déjà contenir le candidat autorisé au test externe.
export async function syncAppleBeta(email: string, wanted: boolean): Promise<boolean> {
  const config = env();
  const group = config.BETA_ASC_GROUP_ID;
  if (!group || !config.BETA_ASC_KEY_ID || !config.BETA_ASC_ISSUER || !config.BETA_ASC_PRIVATE_KEY) return false;
  const privateKey = await importPKCS8(config.BETA_ASC_PRIVATE_KEY.replaceAll("\\n", "\n"), "ES256");
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.BETA_ASC_KEY_ID, typ: "JWT" })
    .setIssuer(config.BETA_ASC_ISSUER)
    .setAudience("appstoreconnect-v1")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  const request = (path: string, method = "GET", body?: unknown) =>
    fetch("https://api.appstoreconnect.apple.com/v1/" + path, {
      method,
      headers: { Authorization: "Bearer " + jwt, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  const query = new URLSearchParams({ "filter[email]": email, limit: "1" });
  const found = await request("betaTesters?" + query);
  if (!found.ok) throw new Error("beta_provider");
  const entry = z.object({ data: z.array(tester) }).parse(await found.json()).data[0];
  if (!entry) {
    if (!wanted) return true;
    const result = await request("betaTesters", "POST", {
      data: {
        type: "betaTesters",
        attributes: { email },
        relationships: { betaGroups: { data: [{ type: "betaGroups", id: group }] } },
      },
    });
    if (!result.ok) throw new Error("beta_provider");
    return true;
  }
  const membership = await request(
    "betaGroups/" + encodeURIComponent(group) + "/relationships/betaTesters",
    wanted ? "POST" : "DELETE",
    { data: [entry] },
  );
  if (!membership.ok) throw new Error("beta_provider");
  return true;
}
