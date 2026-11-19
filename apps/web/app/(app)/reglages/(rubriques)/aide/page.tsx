import { can, requiresParentalConsent } from "@tartan/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Rows, Sheet, SheetSection } from "@/components/sheet";
import { Button } from "@/components/ui/button";
import { ReferralSection } from "@/features/settings/referral-section";
import { loadReferral, requireRubric } from "@/features/settings/rubric-access";
import { LinkRow } from "@/features/settings/setting-rows";
import { FIRST_STEPS_PATH } from "@/lib/onboarding-paths";
import { isAdmin } from "@/server/admin.service";
import { getMe } from "@/server/me.service";

export const metadata: Metadata = { title: w.settings.rubrics.aide.title };

export default async function AideSettingsPage() {
  const { actor, access } = await requireRubric("aide");
  const athlete = access.role === "athlete";
  // Le parrainage du propriétaire est dans « Abonnement ». Ici : les autres coachs qui invitent, et l'athlète
  // adulte. Les athlètes mineurs ne participent à aucune mécanique de parrainage.
  const birthDate = athlete ? (await getMe(actor.userId)).birthDate : null;
  const adultAthlete = athlete && Boolean(birthDate) && !requiresParentalConsent(birthDate, new Date());
  const coachReferral = can(access.role, "inviteAthlete") && !can(access.role, "manageSubscription");
  const [referral, admin] = await Promise.all([
    coachReferral || adultAthlete ? loadReferral(actor.userId) : null,
    isAdmin(actor.email),
  ]);
  const t = w.settings.aide;
  return (
    <Sheet className="divide-y divide-card-line">
      <SheetSection id="aide" title={t.section}>
        <Rows>
          {/* Le coach retrouve ici ses premiers pas, après le tour de piste. */}
          {!athlete ? (
            <LinkRow href={FIRST_STEPS_PATH} title={w.onboarding.page.title} detail={w.onboarding.page.lead} />
          ) : null}
          <LinkRow document href="/aide" title={m.help.center} detail={t.centerDetail} />
          <LinkRow document href="/contact" title={m.settings.helpContact} detail={m.settings.helpDetail} />
          <LinkRow href="/nouveautes" title={m.releases.title} detail={t.releasesDetail} />
          <LinkRow href="/synchronisation" title={m.syncReview.title} detail={t.syncDetail} />
        </Rows>
      </SheetSection>
      {referral ? <ReferralSection referral={referral} athlete={athlete} /> : null}
      {admin ? (
        <SheetSection id="console" title={m.admin.title}>
          <Button asChild size="sm" variant="secondary">
            <Link href="/admin">{m.admin.title}</Link>
          </Button>
        </SheetSection>
      ) : null}
    </Sheet>
  );
}
