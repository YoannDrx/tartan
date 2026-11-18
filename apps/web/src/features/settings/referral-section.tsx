import { m } from "@tartan/i18n";
import { SheetSection } from "@/components/sheet";
import { ReferralLink } from "./shared";

// Le parrainage : dans « Abonnement » pour le propriétaire, dans « Aide » pour les autres coachs et l'athlète adulte.
export const ReferralSection = ({
  referral,
  athlete,
}: {
  referral: { link: string; signups: number; paying: number; months: number };
  athlete: boolean;
}) => (
  <SheetSection id="parrainage" title={m.settings.referral}>
    <div className="flex flex-col gap-2">
      <p>{athlete ? m.settings.referralAthleteDetail : m.settings.referralDetail}</p>
      <ReferralLink link={referral.link} />
      <p className="t-caption font-normal text-soft">
        {m.settings.referralCounts(referral.signups, referral.paying, referral.months)}
      </p>
    </div>
  </SheetSection>
);
