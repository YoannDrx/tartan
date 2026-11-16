import { exerciseFamily } from "@tartan/contracts";
import { EXERCISE_CATALOG } from "@tartan/domain/exercise-catalog";
import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { AdminNav } from "@/features/admin/console-ui";
import { MotionFamily } from "@/features/admin/motion-board";
import { approvedMotionFamilies } from "@/server/motion-review.service";

// L'atelier des gestes animés. L'accès est celui de toute la console : administrateur, passkey vérifiée (layout).
export default async function AdminMovementsPage() {
  const approved = await approvedMotionFamilies();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={m.admin.nav.movements} detail={m.admin.movements.lead} />
      <AdminNav current="/admin/mouvements" />
      {exerciseFamily.options.map((family) => (
        <MotionFamily
          key={family}
          family={family}
          approved={approved}
          entries={EXERCISE_CATALOG.filter((entry) => entry.guide.family === family).map((entry) => ({
            key: entry.catalogKey,
            name: entry.name,
            guide: entry.guide,
          }))}
        />
      ))}
    </div>
  );
}
