import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { plannerServerEnabled } from "@tartan/domain";
import { env } from "@/lib/env";
import { THEME_COOKIE, themePreference } from "@/features/shell/theme";
import { OfflineProvider } from "@/features/offline/offline-provider";
import { OnboardingProvider } from "@/features/onboarding/onboarding-context";
import { AppShell } from "@/features/shell/app-shell";
import { requireSpace } from "@/features/shell/space";
import { isAdmin } from "@/server/admin.service";
import { getBillingAlert } from "@/server/billing.service";
import { getMe } from "@/server/me.service";
import { getOnboardingMemory } from "@/server/onboarding.service";
import { unseenRelease } from "@/server/releases.service";
import { shouldAskSatisfaction } from "@/server/satisfaction.service";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { actor, space, spaces, staff } = await requireSpace();
  const [askSatisfaction, me, unseen, billingAlert, onboarding] = await Promise.all([
    shouldAskSatisfaction(actor.userId),
    getMe(actor.userId),
    unseenRelease(actor.userId, "web", staff ? "coach" : "athlete"),
    staff ? getBillingAlert(actor.userId, space.organizationId) : null,
    getOnboardingMemory(actor.userId, space.organizationId),
  ]);
  // L'athlète d'un club planifie pour lui dans son carnet, déjà ouvert ou à ouvrir depuis « Planifier ».
  const notebook = spaces.find((s) => s.kind === "personal");
  const notebookPlanner =
    !staff &&
    space.kind !== "personal" &&
    (notebook ? Boolean(notebook.aiPlannerEnabled) : Boolean(me.notebook?.available) && plannerServerEnabled(env()));
  const name = `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim() || null;
  const theme = themePreference((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <div data-theme={theme}>
      <OfflineProvider organizationId={space.organizationId} userId={actor.userId}>
        <OnboardingProvider
          organizationId={space.organizationId}
          staff={staff}
          guided={onboarding.guided}
          tourDue={onboarding.tourDue}
          seenScreens={onboarding.seenScreens}
          plannerAvailable={Boolean(space.aiPlannerEnabled)}
        >
          <AppShell
            staff={staff}
            space={space}
            spaces={spaces}
            account={{
              name,
              email: me.email,
              firstName: me.firstName,
              lastName: me.lastName,
              avatarUrl: me.avatarUrl,
              avatarPreset: me.avatarPreset,
            }}
            admin={await isAdmin(actor.email)}
            askSatisfaction={askSatisfaction}
            unseenRelease={unseen}
            billingAlert={billingAlert}
            notebookPlanner={notebookPlanner}
          >
            {children}
          </AppShell>
        </OnboardingProvider>
      </OfflineProvider>
    </div>
  );
}
