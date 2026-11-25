import { importPKCS8, SignJWT } from "jose";
import { z } from "zod";
import { env } from "@/lib/env";

const tester = z.object({ type: z.literal("betaTesters"), id: z.string().min(1) });

const candidate = z.object({
  data: z.object({
    attributes: z.object({ expired: z.boolean() }),
    relationships: z.object({
      betaGroups: z.object({ data: z.array(z.object({ id: z.string() })) }),
      buildBetaDetail: z.object({ data: z.object({ id: z.string() }).nullable() }),
    }),
  }),
  included: z.array(
    z.object({ type: z.string(), id: z.string(), attributes: z.object({ externalBuildState: z.string().optional() }) }),
  ),
});
export function canInviteToAppleBuild(input: unknown, group: string) {
  const response = candidate.safeParse(input);
  if (!response.success) return false;
  const { data, included } = response.data;
  const detail = data.relationships.buildBetaDetail.data;
  return (
    !data.attributes.expired &&
    data.relationships.betaGroups.data.some((g) => g.id === group) &&
    included.some(
      (i) =>
        i.type === "buildBetaDetails" &&
        i.id === detail?.id &&
        ["READY_FOR_BETA_TESTING", "IN_BETA_TESTING"].includes(i.attributes.externalBuildState ?? ""),
    )
  );
}

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
  if (wanted) {
    const build = config.BETA_ASC_BUILD_ID;
    if (!build) return false;
    const fields = new URLSearchParams({
      include: "buildBetaDetail,betaGroups",
      "fields[builds]": "expired,betaGroups,buildBetaDetail",
      "fields[buildBetaDetails]": "externalBuildState",
      "fields[betaGroups]": "name",
    });
    const status = await request("builds/" + encodeURIComponent(build) + "?" + fields);
    if (!status.ok) throw new Error("beta_provider");
    if (!canInviteToAppleBuild(await status.json(), group)) return false;
  }
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
