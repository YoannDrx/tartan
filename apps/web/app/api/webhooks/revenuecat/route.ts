import { NextResponse } from "next/server";

// Offre payante en V2 (§ 17.5) : le pilote est gratuit, aucun événement n'est attendu.
export async function POST() {
  return NextResponse.json({ message: "Non activé pendant le pilote" }, { status: 501 });
}
