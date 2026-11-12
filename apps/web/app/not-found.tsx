import Link from "next/link";
import { m } from "@tartan/i18n";
import { Athlete } from "@/components/athlete";
import { Button } from "@/components/ui/button";
import { PublicPage } from "@/features/shell/public-page";

export default function NotFound() {
  return (
    <PublicPage title={m.common.notFound} world="couloir">
      {/* Noé, tombé sur le dos de l'autre côté de la barre : la page n'est pas là où on l'attendait. */}
      <Athlete id="highJump" pose="landing" on="lane" className="mb-4 size-56" />
      <Button asChild>
        <Link href="/accueil">Revenir à l'accueil</Link>
      </Button>
    </PublicPage>
  );
}
