import type { Metadata } from "next";
import { w } from "@tartan/i18n/web";
import { ProfileSheet } from "@/features/settings/profil/profile-sheet";
import { requireRubric } from "@/features/settings/rubric-access";
import { getMe } from "@/server/me.service";

export const metadata: Metadata = { title: w.settings.rubrics.profil.title };

export default async function ProfilPage() {
  const { actor } = await requireRubric("profil");
  return <ProfileSheet me={await getMe(actor.userId)} />;
}
