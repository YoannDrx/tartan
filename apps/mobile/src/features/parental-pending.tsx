import { useMutation } from "@tanstack/react-query";
import { m } from "@tartan/i18n";
import { resendParentalConsent } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { Button, Card, T } from "../ui/primitives";

// Accord du parent en attente : l'athlète voit pourquoi santé et vidéos sont masquées, et peut relancer la demande.
export const ParentalPending = ({ orgId }: { orgId: string }) => {
  const nudge = useMutation({ mutationFn: () => resendParentalConsent(orgId) });
  return (
    <Card>
      <T variant="small">{m.parental.pendingBanner}</T>
      <Button
        testID="parental-resend"
        label={m.mobile.parentalNudge.action}
        variant="secondary"
        compact
        loading={nudge.isPending}
        disabled={nudge.isSuccess}
        onPress={() => nudge.mutate()}
      />
      {nudge.isSuccess ? (
        <T variant="small" accessibilityLiveRegion="polite">
          {m.mobile.parentalNudge.sent}
        </T>
      ) : null}
      {nudge.isError ? (
        <T variant="small" tone="danger" accessibilityLiveRegion="polite">
          {errorMessage(nudge.error)}
        </T>
      ) : null}
    </Card>
  );
};
