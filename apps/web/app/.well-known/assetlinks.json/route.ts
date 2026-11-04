import { NextResponse } from "next/server";

// App Links Android. L'empreinte vient du certificat de signature Google Play.
export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (fingerprints.length === 0) return new NextResponse(null, { status: 404 });
  return NextResponse.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: "coach.tartan.app", sha256_cert_fingerprints: fingerprints },
    },
  ]);
}
