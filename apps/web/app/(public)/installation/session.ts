"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { betaAccess } from "@/server/beta-testers.service";
export async function openBeta(form: FormData) {
  const token = form.get("token");
  const jar = await cookies();
  if (typeof token === "string" && (await betaAccess(token))) {
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
