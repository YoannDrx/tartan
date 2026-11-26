// Usage : pnpm --filter @tartan/web beta:stage chemin.apk (Android SDK Build Tools dans PATH).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { put, head } from "@vercel/blob";
import { tmpdir } from "node:os";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
const apk = await readFile(process.argv[2]);
const stage = await mkdtemp(path.join(tmpdir(), "tartan-apk-"));
try {
  const file = path.join(stage, "candidate.apk");
  await writeFile(file, apk, { mode: 0o600 });
  const certificates = execFileSync("apksigner", ["verify", "--print-certs", file], { encoding: "utf8" });
  const signers = [...certificates.matchAll(/^Signer #\d+ certificate SHA-256 digest: (\w+)$/gm)];
  const cert = signers[0]?.[1]?.toLowerCase();
  if (signers.length !== 1 || !cert || cert !== process.env.BETA_APK_CERT_SHA256?.toLowerCase())
    throw Error("Signature");
  const info = execFileSync("aapt", ["dump", "badging", file], { encoding: "utf8" });
  const pkg = /^package: name='coach\.tartan\.app' versionCode='(\d+)' versionName='([^']+)'/m.exec(info);
  if (!pkg) throw Error("Package");
  const build = Number(pkg[1]),
    version = pkg[2];
  const digest = createHash("sha256").update(apk).digest("hex");
  const pathname = `beta/verified/${digest}.apk`;
  const options = { token: process.env.BETA_APK_READ_WRITE_TOKEN, access: "private", addRandomSuffix: false };
  if (!options.token) throw Error("BETA_APK_READ_WRITE_TOKEN");
  try {
    await put(pathname, apk, { ...options, multipart: true, allowOverwrite: false });
  } catch (error) {
    const prior = await head(pathname, { token: options.token });
    if (prior.size !== apk.length) throw error;
  }
  await put("beta/staged.json", JSON.stringify({ build, version, digest, cert }), {
    ...options,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
  console.log("APK vérifié et préparé", version, build);
} finally {
  await rm(stage, { recursive: true, force: true });
}
