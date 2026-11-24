import { encouragementLabels as labels, encouragementTones, m } from "@tartan/i18n";
import { preferencesInput } from "@tartan/contracts";
import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/session";
import { getMe, updatePreferences } from "@/server/me.service";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { w } from "@tartan/i18n/web";
import { Sheet, SheetSection } from "@/components/sheet";
import { ThemeChoice } from "@/features/settings/apparence/theme-choice";
import { requireRubric } from "@/features/settings/rubric-access";
import { THEME_COOKIE, themePreference } from "@/features/shell/theme";

export const metadata: Metadata = { title: w.settings.rubrics.apparence.title };

export default async function ApparencePage() {
  const { actor } = await requireRubric("apparence");
  const me = await getMe(actor.userId);
  async function save(form: FormData) {
    "use server";
    const actor = await requireActor();
    await updatePreferences(
      actor.userId,
      preferencesInput.parse({ homeTone: form.get("homeTone"), sessionTone: form.get("sessionTone") }),
    );
    revalidatePath("/reglages/apparence");
    revalidatePath("/aujourdhui");
  }
  const theme = themePreference((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <Sheet>
      <SheetSection id="apparence" title={w.settings.apparence.section}>
        <ThemeChoice initial={theme} />
      </SheetSection>
      <SheetSection id="encouragements" title={labels.title}>
        <form action={save} className="flex flex-col items-start gap-3">
          {(["homeTone", "sessionTone"] as const).map((key) => (
            <label key={key} className="flex flex-col gap-1">
              {key === "homeTone" ? labels.home : labels.session}
              <select
                name={key}
                defaultValue={me.preferences?.[key] ?? "calm"}
                className="min-h-12 rounded-button border border-card-line p-2"
              >
                {encouragementTones.map((tone) => (
                  <option key={tone} value={tone}>
                    {labels[tone]}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <Button type="submit">{m.common.save}</Button>
        </form>
      </SheetSection>
    </Sheet>
  );
}
