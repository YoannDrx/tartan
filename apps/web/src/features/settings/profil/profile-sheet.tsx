import type { MeResponse } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { w } from "@tartan/i18n/web";
import { Sheet, SheetSection } from "@/components/sheet";
import { env } from "@/lib/env";
import { AvatarForm, ProfileForm } from "./profile-forms";

// La rubrique « Profil » : la page `/reglages/profil`, et le volet du sommaire sur ordinateur.
export const ProfileSheet = ({ me }: { me: MeResponse }) => (
  <Sheet>
    <SheetSection id="profil" title={w.settings.profil.section}>
      <div className="flex flex-col gap-4">
        <p>
          <span className="t-caption block text-soft">{m.auth.emailLabel}</span>
          <span className="break-all">{me.email}</span>
        </p>
        {env().BLOB_READ_WRITE_TOKEN ? (
          <AvatarForm avatarUrl={me.avatarUrl} name={`${me.firstName ?? ""} ${me.lastName ?? ""}`.trim() || me.email} />
        ) : null}
        <ProfileForm
          firstName={me.firstName ?? ""}
          lastName={me.lastName ?? ""}
          birthDate={me.birthDate ?? ""}
          units={me.units}
        />
      </div>
    </SheetSection>
  </Sheet>
);
