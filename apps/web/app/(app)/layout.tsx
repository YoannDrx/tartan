import type { ReactNode } from "react";
import { OfflineProvider } from "@/features/offline/offline-provider";
import { AppShell } from "@/features/shell/app-shell";
import { requireSpace } from "@/features/shell/space";
import { shouldAskSatisfaction } from "@/server/satisfaction.service";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { actor, spaces, space, staff } = await requireSpace();
  const askSatisfaction = await shouldAskSatisfaction(actor.userId);
  return (
    <OfflineProvider organizationId={space.organizationId} userId={actor.userId}>
      <AppShell staff={staff} spaces={spaces} space={space} askSatisfaction={askSatisfaction}>
        {children}
      </AppShell>
    </OfflineProvider>
  );
}
