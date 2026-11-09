import { m } from "@tartan/i18n";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireSpace } from "@/features/shell/space";
import { isAdmin } from "@/server/admin.service";
import { hasFreshStepUp, STEP_UP_READ_MS } from "@/server/admin-step-up.service";

export const metadata: Metadata = { title: m.admin.title, robots: { index: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { actor } = await requireSpace();
  if (!(await isAdmin(actor.email))) redirect("/accueil");
  if (!(await hasFreshStepUp(actor.sessionId, STEP_UP_READ_MS))) redirect("/verification-admin");
  return children;
}
