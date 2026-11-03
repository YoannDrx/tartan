import type { ReactNode } from "react";
import { OfflineProvider } from "@/features/offline/offline-provider";
import { AppShell } from "@/features/shell/app-shell";
import { requireSpace } from "@/features/shell/space";
import { isAdmin } from "@/server/admin.service";
import { getMe } from "@/server/me.service";
import { shouldAskSatisfaction } from "@/server/satisfaction.service";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { actor, spaces, space, staff } = await requireSpace();
  const [askSatisfaction, me] = await Promise.all([shouldAskSatisfaction(actor.userId), getMe(actor.userId)]);
  const name = `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim() || null;
  return (
    <OfflineProvider organizationId={space.organizationId} userId={actor.userId}>
      <AppShell
        staff={staff}
        spaces={spaces}
        space={space}
        account={{ name, email: me.email }}
        admin={isAdmin(actor.email)}
        askSatisfaction={askSatisfaction}
      >
        {children}
      </AppShell>
    </OfflineProvider>
  );
}
