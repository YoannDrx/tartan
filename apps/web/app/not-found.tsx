import Link from "next/link";
import { m } from "@tartan/i18n";
import { Jumper } from "@/components/jumper";
import { Button } from "@/components/ui/button";
import { PublicPage } from "@/features/shell/public-page";

export default function NotFound() {
  return (
    <PublicPage title={m.common.notFound} world="couloir">
      <Jumper pose="landing" className="mb-4 size-56" />
      <Button asChild>
        <Link href="/accueil">Revenir à l'accueil</Link>
      </Button>
    </PublicPage>
  );
}
