import type { Metadata } from "next";
import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { AdminNav, DataTable, day } from "@/features/admin/console-ui";
import { GameModeration } from "@/features/admin/game-moderation";
import { requireSpace } from "@/features/shell/space";
import { adminGameScores } from "@/server/game.service";

export const metadata: Metadata = { title: m.admin.nav.game, robots: { index: false } };

const t = m.admin.game;

// Les derniers scores du classement du jeu : masquer un score, bannir un appareil.
export default async function AdminGamePage() {
  const { actor } = await requireSpace();
  const scores = await adminGameScores(actor);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={m.admin.nav.game} detail={t.lead} />
      <AdminNav current="/admin/jeu" />
      <DataTable
        caption={m.admin.nav.game}
        empty={t.empty}
        columns={[t.pseudo, t.event, t.score, t.date, t.state, t.actions]}
        rows={scores.map((row) => [
          row.pseudo,
          m.game.events[row.eventId as keyof typeof m.game.events]?.title ?? row.eventId,
          row.eventId === "hurdles" ? m.game.seconds(row.score) : m.game.distance(row.score),
          day(row.createdAt),
          row.hidden ? t.hidden : t.visible,
          <GameModeration key="moderation" id={row.id} hidden={row.hidden} />,
        ])}
      />
    </div>
  );
}
