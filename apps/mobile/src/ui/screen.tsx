import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, useWindowDimensions, View, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsOnline } from "../lib/network";
import { useOpQueue } from "../lib/sync/op-queue";
import { useUploads } from "../lib/upload/upload-queue";
import { ArrowLeft, CloudOff, CloudUpload, Settings, X } from "./icons";
import { IconButton, T } from "./primitives";
import { SpaceSwitcher } from "./space-switcher";
import { color, GUTTER, radius, Scene, space, usePalette } from "./theme";

const CONTENT_MAX = 720;

// Hors ligne ou envois en attente : l'état se lit sans chercher.
export const SyncBanner = () => {
  const online = useIsOnline();
  const ops = useOpQueue((s) => s.items.length);
  const rejected = useOpQueue((s) => s.rejectedCount);
  const dismiss = useOpQueue((s) => s.dismissRejected);
  const uploads = useUploads((s) => s.items.length);
  const pending = ops + uploads;
  if (rejected > 0) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          backgroundColor: color.brandTint,
          borderRadius: radius.card,
          paddingLeft: space.md,
          paddingVertical: space.xs,
        }}
      >
        <T variant="caption" style={{ flex: 1, color: color.brandStrong }} accessibilityLiveRegion="polite">
          {m.mobile.validation.rejected}
        </T>
        <IconButton icon={X} label={m.common.close} onPress={dismiss} />
      </View>
    );
  }
  if (online && pending === 0) return null;
  const Icon = online ? CloudUpload : CloudOff;
  const parts = [
    online ? null : m.mobile.offline.banner,
    pending > 0 ? m.mobile.offline.pending(pending) : null,
  ].filter(Boolean);
  return (
    <View
      accessibilityLiveRegion="polite"
      accessible
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        backgroundColor: color.warningTint,
        borderRadius: radius.card,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
      }}
    >
      <Icon size={18} color={color.warningStrong} accessibilityElementsHidden importantForAccessibility="no" />
      <T variant="caption" style={{ flex: 1, color: color.warningStrong }}>
        {parts.join(" ")}
      </T>
    </View>
  );
};

type TabScreenProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scrollProps?: ScrollViewProps;
};

// Écran d'onglet : sélecteur d'espace, titre, contenu défilant, tirer pour actualiser.
export const TabScreen = ({ title, subtitle, right, children, refreshing, onRefresh, scrollProps }: TabScreenProps) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const { width } = useWindowDimensions();
  const pad = width > CONTENT_MAX + GUTTER * 2 ? (width - CONTENT_MAX) / 2 : GUTTER;
  // L'indicateur ne suit que le geste de l'utilisateur, pas les actualisations d'arrière-plan.
  const [pulled, setPulled] = useState(false);
  useEffect(() => {
    if (!refreshing) setPulled(false);
  }, [refreshing]);
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top }}>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: space.sm,
          paddingHorizontal: pad,
          paddingBottom: space.xxl,
          gap: space.lg,
        }}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={pulled && Boolean(refreshing)}
              onRefresh={() => {
                setPulled(true);
                onRefresh();
              }}
              tintColor={p.accent}
              colors={[p.accent]}
            />
          ) : undefined
        }
        {...scrollProps}
      >
        <SpaceSwitcher />
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="display" heading>
              {title}
            </T>
            {subtitle ? (
              <T variant="small" tone="muted">
                {subtitle}
              </T>
            ) : null}
          </View>
          {right}
          <IconButton
            testID="open-settings"
            icon={Settings}
            label={m.mobile.a11y.openSettings}
            tone="filled"
            onPress={() => router.push("/settings")}
          />
        </View>
        <SyncBanner />
        {children}
      </ScrollView>
    </View>
  );
};

type StackScreenProps = {
  title?: string;
  subtitle?: string;
  dark?: boolean;
  onBack?: () => void;
  backIcon?: "back" | "close";
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
};

const StackInner = ({
  title,
  subtitle,
  onBack,
  backIcon = "back",
  right,
  children,
  scroll = true,
  footer,
}: Omit<StackScreenProps, "dark">) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const { width } = useWindowDimensions();
  const pad = width > CONTENT_MAX + GUTTER * 2 ? (width - CONTENT_MAX) / 2 : GUTTER;
  const content = {
    paddingHorizontal: pad,
    paddingBottom: footer ? space.lg : insets.bottom + space.xxl,
    gap: space.lg,
  };
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          paddingHorizontal: pad - space.xs,
          paddingVertical: space.sm,
          minHeight: 60,
        }}
      >
        <IconButton
          icon={backIcon === "close" ? X : ArrowLeft}
          label={backIcon === "close" ? m.common.close : m.common.back}
          tone="filled"
          onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/")))}
        />
        <View style={{ flex: 1 }}>
          {title ? (
            <T variant="title2" heading numberOfLines={2}>
              {title}
            </T>
          ) : null}
          {subtitle ? (
            <T variant="caption" tone="muted" numberOfLines={2}>
              {subtitle}
            </T>
          ) : null}
        </View>
        {right}
      </View>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={content}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, content]}>{children}</View>
      )}
      {footer ? (
        <View
          style={{
            paddingHorizontal: pad,
            paddingTop: space.sm,
            paddingBottom: Math.max(insets.bottom, space.lg),
            gap: space.sm,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
};

export const StackScreen = ({ dark, ...rest }: StackScreenProps) => (
  <Scene dark={dark}>
    <StackInner {...rest} />
  </Scene>
);
