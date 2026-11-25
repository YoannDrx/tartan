import { w } from "@tartan/i18n/web";
import { OpenBetaForm } from "./open-form";
export const metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default function InstallPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-5">
      <h1 className="t-h1">{w.admin.testers.install}</h1>
      <OpenBetaForm />
    </main>
  );
}
