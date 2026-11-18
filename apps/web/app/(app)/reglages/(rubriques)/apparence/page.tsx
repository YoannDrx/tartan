import type { Metadata } from "next";
import { cookies } from "next/headers";
import { w } from "@tartan/i18n/web";
import { Sheet, SheetSection } from "@/components/sheet";
import { ThemeChoice } from "@/features/settings/apparence/theme-choice";
import { requireRubric } from "@/features/settings/rubric-access";
import { THEME_COOKIE, themePreference } from "@/features/shell/theme";

export const metadata: Metadata = { title: w.settings.rubrics.apparence.title };

export default async function ApparencePage() {
  await requireRubric("apparence");
  const theme = themePreference((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <Sheet>
      <SheetSection id="apparence" title={w.settings.apparence.section}>
        <ThemeChoice initial={theme} />
      </SheetSection>
    </Sheet>
  );
}
