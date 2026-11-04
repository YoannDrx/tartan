import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { applyUnsubscribe } from "@/server/email-preferences.service";

type Params = { params: Promise<{ kind: string; token: string }> };

// POST seul : un GET peut venir d'un antivirus qui suit les liens, et ne doit rien couper.
export async function POST(request: Request, { params }: Params) {
  const { kind, token } = await params;
  try {
    await applyUnsubscribe(kind, token);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      return NextResponse.json({ message: "Lien inconnu" }, { status: 404 });
    }
    throw error;
  }
  // Le formulaire de la page revient sur la page ; un client de messagerie n'attend qu'un 200.
  if (request.headers.get("accept")?.includes("text/html")) {
    return NextResponse.redirect(new URL(`/e-mails/${kind}/${token}?fait=1`, request.url), 303);
  }
  return NextResponse.json({ ok: true });
}
