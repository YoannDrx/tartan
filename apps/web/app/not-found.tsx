import Link from "next/link";
import { m } from "@tartan/i18n";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-start justify-center gap-4 px-4">
      <h1 className="t-display">{m.common.notFound}</h1>
      <Button asChild variant="secondary">
        <Link href="/accueil">Revenir à l'accueil</Link>
      </Button>
    </main>
  );
}
