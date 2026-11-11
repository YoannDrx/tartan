import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { GET } from "../app/(app)/admin/revenus/export/route";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getActorFrom } from "@/lib/session";
import { recordStepUp, STEP_UP_READ_MS } from "@/server/admin-step-up.service";
import { addAthlete, makeOrg, makeUser } from "./helpers";
import { sessionCookie } from "./personas";

// Le vrai handler, avec de vraies sessions : rien n'est simulé.
const exportFor = (cookie: string | null, query = "") =>
  GET(
    new Request(`http://localhost:3000/admin/revenus/export${query}`, {
      headers: cookie ? { cookie } : {},
    }),
  );

const sessionIdOf = async (cookie: string) => (await getActorFrom(new Headers({ cookie })))!.sessionId!;

// Années réservées à ce fichier : d'autres tests créent aussi des factures.
const YEAR = 2041;
const CUSTOMER = `cus_${randomUUID()}`;
const invoice = (overrides: {
  number: string | null;
  paidAt: Date | null;
  livemode?: boolean;
  organizationId?: string;
  totalCents?: number;
  amountPaidCents?: number;
  taxCents?: number;
  refundedCents?: number;
}) =>
  prisma.billingInvoice.create({
    data: {
      id: `in_${randomUUID()}`,
      livemode: overrides.livemode ?? true,
      organizationId: overrides.organizationId,
      stripeCustomerId: CUSTOMER,
      stripeSubscriptionId: `sub_${randomUUID()}`,
      number: overrides.number,
      status: overrides.paidAt ? "paid" : "open",
      currency: "eur",
      totalCents: overrides.totalCents ?? 1900,
      amountPaidCents: overrides.amountPaidCents ?? (overrides.paidAt ? 1900 : 0),
      taxCents: overrides.taxCents ?? 0,
      refundedCents: overrides.refundedCents ?? 0,
      paidAt: overrides.paidAt,
      stripeCreatedAt: overrides.paidAt ?? new Date(Date.UTC(YEAR, 5, 1)),
      syncedAt: new Date(),
    },
  });

let admin: { userId: string; email: string; cookie: string };
let coach: { email: string; cookie: string; organizationId: string };

beforeAll(async () => {
  env().ADMIN_EMAILS = "";
  const adminUser = await makeUser("Comptable");
  await prisma.platformAdmin.create({ data: { email: adminUser.email } });
  admin = { ...adminUser, cookie: await sessionCookie(adminUser.email) };
  const space = await makeOrg("ClientFacture");
  coach = {
    email: space.owner.email,
    cookie: await sessionCookie(space.owner.email),
    organizationId: space.organizationId,
  };
  // Une blessure en base : l'export ne doit jamais s'en approcher.
  const athlete = await addAthlete(space.organizationId, space.groupId, "Blesse");
  await prisma.injury.create({
    data: {
      organizationId: space.organizationId,
      athleteId: athlete.athleteId,
      bodyArea: "ischio",
      description: "SENTINELLE-SANTE-EXPORT",
      startDate: new Date(Date.UTC(YEAR, 0, 5)),
    },
  });

  await invoice({
    number: "TARTAN-0002",
    paidAt: new Date(Date.UTC(YEAR, 6, 14, 9)),
    organizationId: space.organizationId,
    totalCents: 19000,
    amountPaidCents: 19000,
    taxCents: 3167,
    refundedCents: 500,
  });
  await invoice({ number: "TARTAN-0001", paidAt: new Date(Date.UTC(YEAR, 0, 1, 0, 0, 0)) });
  // Hors de l'export : autre année, mode test, facture non payée.
  await invoice({ number: "TARTAN-AVANT", paidAt: new Date(Date.UTC(YEAR - 1, 11, 31, 23, 59, 59)) });
  await invoice({ number: "TARTAN-APRES", paidAt: new Date(Date.UTC(YEAR + 1, 0, 1)) });
  await invoice({ number: "TARTAN-ESSAI", paidAt: new Date(Date.UTC(YEAR, 3, 2)), livemode: false });
  await invoice({ number: "TARTAN-OUVERTE", paidAt: null });
}, 60_000);

describe("export comptable : qui peut le télécharger", () => {
  it("personne sans session", async () => {
    const response = await exportFor(null, `?annee=${YEAR}`);
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("TARTAN-");
  });

  it("pas un coach, même propriétaire d'un espace facturé", async () => {
    const response = await exportFor(coach.cookie, `?annee=${YEAR}`);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "forbidden" });
  });

  it("pas un administrateur dont la passkey n'est pas vérifiée dans la session, ou l'a été il y a trop longtemps", async () => {
    const sessionId = await sessionIdOf(admin.cookie);
    await prisma.adminStepUp.deleteMany({ where: { sessionId } });
    const never = await exportFor(admin.cookie, `?annee=${YEAR}`);
    expect(never.status).toBe(403);
    expect(await never.json()).toMatchObject({ code: "step_up_required" });

    await recordStepUp(sessionId, "passkey", new Date(Date.now() - STEP_UP_READ_MS - 60_000));
    const stale = await exportFor(admin.cookie, `?annee=${YEAR}`);
    expect(stale.status).toBe(403);
    expect(await stale.text()).not.toContain("TARTAN-");
  });
});

describe("export comptable : ce qu'il contient", () => {
  const download = async (query: string) => {
    await recordStepUp(await sessionIdOf(admin.cookie), "passkey");
    return exportFor(admin.cookie, query);
  };

  it("les factures réelles encaissées dans l'année, par date, en centimes", async () => {
    const response = await download(`?annee=${YEAR}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(`attachment; filename="tartan-factures-${YEAR}.csv"`);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.text()).split("\n")).toEqual([
      "numero;date;total_centimes;encaisse_centimes;taxes_centimes;rembourse_centimes;devise",
      `TARTAN-0001;${YEAR}-01-01;1900;1900;0;0;eur`,
      `TARTAN-0002;${YEAR}-07-14;19000;19000;3167;500;eur`,
    ]);
  });

  it("aucune donnée de santé, aucune donnée personnelle, aucun identifiant de client", async () => {
    const texte = await (await download(`?annee=${YEAR}`)).text();
    for (const interdit of [
      "SENTINELLE-SANTE-EXPORT",
      coach.email,
      "ClientFacture",
      coach.organizationId,
      CUSTOMER,
      "sub_",
      "in_",
      "@",
    ]) {
      expect(texte, interdit).not.toContain(interdit);
    }
    // Sept colonnes, toutes comptables : une colonne ajoutée doit passer par ce test.
    for (const line of texte.split("\n")) expect(line.split(";")).toHaveLength(7);
  });

  it("une année sans facture rend l'en-tête seul, une année illisible retombe sur l'année en cours", async () => {
    const empty = await download("?annee=2099");
    expect((await empty.text()).split("\n")).toHaveLength(1);

    const current = new Date().getUTCFullYear();
    for (const query of ["", "?annee=abc", "?annee=1e9", "?annee=2041.5", "?annee=-1"]) {
      const response = await download(query);
      expect(response.status, query).toBe(200);
      expect(response.headers.get("content-disposition"), query).toContain(`tartan-factures-${current}.csv`);
    }
  });
});
