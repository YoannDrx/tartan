"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { betaAccess, recordBetaEvent } from "@/server/beta-testers.service";
export async function openBeta(form: FormData) {
  const token = form.get("token");
  const jar = await cookies();
  if (typeof token === "string" && (await recordBetaEvent(token, "openedAt"))) {
    jar.set("tartan_beta", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/installation",
      maxAge: 86400,
    });
    redirect("/installation/acces");
  }
  redirect("/installation/invalide");
}

export async function openTestFlight() {
  const token = (await cookies()).get("tartan_beta")?.value ?? "";
  if (!(await betaAccess(token))?.ios || !(await recordBetaEvent(token, "appleAt"))) redirect("/installation/invalide");
  redirect("https://apps.apple.com/fr/app/testflight/id899247664");
}
