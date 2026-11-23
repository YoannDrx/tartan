import { w } from "@tartan/i18n/web";
import { DeleteAccount } from "@/features/settings/confidentialite/privacy-forms";
import { SignOutButton } from "@/features/settings/connexion/sessions";

// Un compte sans espace n'a pas de réglages : se déconnecter et supprimer son compte restent à portée.
export const AccountExit = ({ email }: { email: string }) => (
  <section aria-labelledby="ton-compte" className="on-card mt-2 flex flex-col gap-3 rounded-card bg-card p-5">
    <h2 id="ton-compte" className="t-h2">
      {w.welcome.account.title}
    </h2>
    <p className="flex flex-col leading-snug">
      <span className="t-caption font-normal text-soft">{w.welcome.account.signedInAs}</span>
      <span className="break-all font-semibold">{email}</span>
    </p>
    <div className="flex flex-wrap gap-2">
      <SignOutButton />
      <DeleteAccount detail={w.welcome.account.deleteDetail} />
    </div>
  </section>
);
