import { NextResponse } from "next/server";

// Liens universels iOS. APPLE_TEAM_ID est connu à l'ouverture du compte Apple Developer.
export function GET() {
  const team = process.env.APPLE_TEAM_ID;
  // Mieux vaut un 404 honnête qu'un fichier 200 avec un identifiant fictif.
  if (!team) return new NextResponse(null, { status: 404 });
  const paths = [{ "/": "/i/*" }, { "/": "/r/*" }, { "/": "/seance/*" }, { "/": "/mes-sauts/*" }];
  return NextResponse.json({
    applinks: { details: [{ appIDs: [`${team}.coach.tartan.app`], components: paths }] },
    webcredentials: { apps: [`${team}.coach.tartan.app`] },
  });
}
