import { m } from "@tartan/i18n";
import { StrengthCalculator } from "../src/features/strength-calculator";
import { useTrainingSpace } from "../src/lib/queries";
import { StackScreen } from "../src/ui/screen";
import { T } from "../src/ui/primitives";
import { LoadingState } from "../src/ui/states";

export default function LoadCalculator() {
  const { me, space } = useTrainingSpace();
  return (
    <StackScreen title={m.calculator.title}>
      {me.isPending ? (
        <LoadingState />
      ) : space?.progressionEnabled ? (
        <>
          <T tone="muted">{m.calculator.intro}</T>
          <StrengthCalculator />
        </>
      ) : (
        <T>{m.progression.disabled}</T>
      )}
    </StackScreen>
  );
}
