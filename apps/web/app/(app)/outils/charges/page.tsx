import { m } from "@tartan/i18n";
import { PageHeader } from "@/components/states";
import { StrengthCalculator } from "@/features/progression/strength-calculator";
import { requireSpace } from "@/features/shell/space";

export const metadata = { title: m.calculator.title };
export default async function LoadCalculatorPage() {
  const { space } = await requireSpace();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader title={m.calculator.title} detail={m.calculator.intro} />
      {space.progressionEnabled ? <StrengthCalculator /> : <p>{m.progression.disabled}</p>}
    </div>
  );
}
