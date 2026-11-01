import type { ReactNode } from "react";
import { OfflineProvider } from "@/features/offline/offline-provider";
import { AppShell } from "@/features/shell/app-shell";
import { requireSpace } from "@/features/shell/space";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { actor, spaces, space, staff } = await requireSpace();
  return (
    <OfflineProvider organizationId={space.organizationId} userId={actor.userId}>
      <AppShell staff={staff} spaces={spaces} space={space}>
        {children}
      </AppShell>
    </OfflineProvider>
  );
}
