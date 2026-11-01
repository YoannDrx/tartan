import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, View, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsOnline } from "../lib/network";
import { useOpQueue } from "../lib/sync/op-queue";
import { useUploads } from "../lib/upload/upload-queue";
import { ArrowLeft, CloudOff, CloudUpload, Settings, X } from "./icons";
import { IconButton, LaneLine, ListSurface, T } from "./primitives";
import { SpaceSwitcher } from "./space-switcher";
import { Scene, scene, space, usePagePad, usePalette } from "./theme";

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
      <ListSurface style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingLeft: space.lg }}>
        <T variant="caption" style={{ flex: 1 }} accessibilityLiveRegion="polite">
          {m.mobile.validation.rejected}
        </T>
        <IconButton icon={X} label={m.common.close} onPress={dismiss} />
      </ListSurface>
    );
  }
  if (online && pending === 0) return null;
  const Icon = online ? CloudUpload : CloudOff;
  const parts = [
    online ? null : m.mobile.offline.banner,
    pending > 0 ? m.mobile.offline.pending(pending) : null,
  ].filter(Boolean);
  return (
    <ListSurface
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space.sm,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
      }}
    >
      <Icon size={18} color={scene.status.partial} accessibilityElementsHidden importantForAccessibility="no" />
      <T variant="caption" accessibilityLiveRegion="polite" style={{ flex: 1 }}>
        {parts.join(" ")}
      </T>
    </ListSurface>
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
  const pad = usePagePad();
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
        automaticallyAdjustKeyboardInsets
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
              tintColor={p.text}
              colors={[scene.card]}
            />
          ) : undefined
        }
        {...scrollProps}
      >
        <SpaceSwitcher />
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="screen" heading maxFontSizeMultiplier={1.3}>
              {title}
            </T>
            {subtitle ? <T variant="small">{subtitle}</T> : null}
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
        <LaneLine />
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
  // Libellé lu par VoiceOver et TalkBack quand le bouton fait plus que revenir en arrière.
  backLabel?: string;
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
  backLabel,
  right,
  children,
  scroll = true,
  footer,
}: Omit<StackScreenProps, "dark">) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const pad = usePagePad();
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
          paddingHorizontal: pad,
          paddingVertical: space.sm,
          minHeight: 60,
        }}
      >
        <IconButton
          icon={backIcon === "close" ? X : ArrowLeft}
          label={backLabel ?? (backIcon === "close" ? m.common.close : m.common.back)}
          tone="filled"
          onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/")))}
        />
        <View style={{ flex: 1 }}>
          {title ? (
            <T variant={p.onRed ? "title1" : "title2"} heading numberOfLines={2}>
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
      {p.onRed && title ? (
        <View style={{ paddingHorizontal: pad, marginBottom: space.lg }}>
          <LaneLine />
        </View>
      ) : null}
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
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
