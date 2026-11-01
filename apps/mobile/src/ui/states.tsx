import { m } from "@tartan/i18n";
import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { errorMessage } from "../lib/errors";
import { LaneArcs } from "./glyphs";
import { Button, T } from "./primitives";
import { space, usePalette } from "./theme";

export const LoadingState = ({ label = m.common.loading, inline }: { label?: string; inline?: boolean }) => {
  const p = usePalette();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: space.md,
        paddingVertical: inline ? space.lg : space.huge,
        flex: inline ? undefined : 1,
      }}
    >
      <ActivityIndicator color={p.accent} size={inline ? "small" : "large"} />
      <T variant="small" tone="muted">
        {label}
      </T>
    </View>
  );
};

export const ErrorState = ({
  error,
  message,
  onRetry,
}: {
  error?: unknown;
  message?: string;
  onRetry?: () => void;
}) => (
  <View
    accessibilityLiveRegion="polite"
    style={{ alignItems: "flex-start", gap: space.md, paddingVertical: space.xxl }}
  >
    <T variant="body">{message ?? errorMessage(error)}</T>
    {onRetry ? <Button label={m.common.retry} variant="secondary" compact onPress={onRetry} /> : null}
  </View>
);

export const EmptyState = ({ title, body, action }: { title?: string; body: string; action?: ReactNode }) => {
  const p = usePalette();
  return (
    <View style={{ paddingVertical: space.xxxl, gap: space.md, overflow: "hidden", minHeight: 160 }}>
      <View
        style={{ position: "absolute", right: -48, bottom: -48 }}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <LaneArcs width={170} height={170} color={p.textMuted} opacity={0.22} />
      </View>
      {title ? (
        <T variant="title2" heading>
          {title}
        </T>
      ) : null}
      <T variant="body" tone="muted" style={{ maxWidth: 300 }}>
        {body}
      </T>
      {action}
    </View>
  );
};
