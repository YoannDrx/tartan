import { get } from "@vercel/blob";
import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { betaAccess } from "@/server/beta-testers.service";
export async function GET(request: NextRequest) {
  const allowed = await betaAccess(request.cookies.get("tartan_beta")?.value ?? "");
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
  if (!allowed?.android) return new Response(null, { status: 403, headers });
  const config = env();
  const result = await get(config.BETA_APK_PATH!, {
    access: "private",
    token: config.BETA_BLOB_TOKEN,
    abortSignal: request.signal,
  });
  if (result?.statusCode !== 200) return new Response(null, { status: 404, headers });
  return new Response(result.stream, {
    headers: {
      ...headers,
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="Tartan.apk"',
      "Content-Length": String(result.blob.size),
    },
  });
}
