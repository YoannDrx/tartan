import { get } from "@vercel/blob";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { betaAccess, recordBetaEvent } from "@/server/beta-testers.service";
export async function GET(request: NextRequest) {
  const token = request.cookies.get("tartan_beta")?.value ?? "";
  const allowed = await betaAccess(token);
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
  if (!allowed?.android || !allowed.apk) return new Response(null, { status: 403, headers });
  const config = env();
  const result = await get(allowed.apk.path, {
    access: "private",
    token: config.BETA_APK_READ_WRITE_TOKEN,
    abortSignal: request.signal,
  });
  if (result?.statusCode !== 200) return new Response(null, { status: 404, headers });
  if (!(await recordBetaEvent(token, "apkAt"))) {
    await result.stream.cancel();
    return new Response(null, { status: 403, headers });
  }
  return new Response(result.stream, {
    headers: {
      ...headers,
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="Tartan.apk"',
      "Content-Length": String(result.blob.size),
    },
  });
}
