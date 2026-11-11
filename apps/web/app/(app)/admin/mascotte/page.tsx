import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { AdminNav } from "@/features/admin/console-ui";
import { MascotBoard } from "@/features/admin/mascot-board";

// Planche de contrôle du groupe. L'accès est celui de toute la console : administrateur, passkey vérifiée (layout).
export default function AdminMascotPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={m.admin.nav.mascot} />
      <AdminNav current="/admin/mascotte" />
      <MascotBoard />
    </div>
  );
}
