import Link from "next/link";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";
import { PublicPage } from "@/features/shell/public-page";

export default function NotFound() {
  return (
    <PublicPage title={m.common.notFound}>
      <Button asChild>
        <Link href="/accueil">Revenir à l'accueil</Link>
      </Button>
    </PublicPage>
  );
}
