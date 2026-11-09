import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { THEME_COOKIE, themePreference } from "@/features/shell/theme";
import { OfflineProvider } from "@/features/offline/offline-provider";
import { AppShell } from "@/features/shell/app-shell";
import { requireSpace } from "@/features/shell/space";
import { isAdmin } from "@/server/admin.service";
import { getMe } from "@/server/me.service";
import { unseenRelease } from "@/server/releases.service";
import { shouldAskSatisfaction } from "@/server/satisfaction.service";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { actor, spaces, space, staff } = await requireSpace();
  const [askSatisfaction, me, unseen] = await Promise.all([
    shouldAskSatisfaction(actor.userId),
    getMe(actor.userId),
    unseenRelease(actor.userId, "web", staff ? "coach" : "athlete"),
  ]);
  const name = `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim() || null;
  const theme = themePreference((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <div data-theme={theme}>
      <OfflineProvider organizationId={space.organizationId} userId={actor.userId}>
        <AppShell
          staff={staff}
          spaces={spaces}
          space={space}
          account={{ name, email: me.email }}
          admin={await isAdmin(actor.email)}
          askSatisfaction={askSatisfaction}
          unseenRelease={unseen}
        >
          {children}
        </AppShell>
      </OfflineProvider>
    </div>
  );
}
