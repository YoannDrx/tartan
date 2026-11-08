import { tokens } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";
import { useFocusEffect, usePathname, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { RefreshControl, ScrollView, View, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsOnline } from "../lib/network";
import { useOpQueue } from "../lib/sync/op-queue";
import { reviewRequiredOps } from "../lib/sync/queue-core";
import { useUploads } from "../lib/upload/upload-queue";
import { ArrowLeft, CloudOff, CloudUpload, Repeat, Settings, X } from "./icons";
import { Button, IconButton, LaneLine, ListSurface, ScreenTitle, T } from "./primitives";
import { SpaceSwitcher } from "./space-switcher";
import { Scene, scene, space, usePagePad, usePalette, type WorldName } from "./theme";

// La barre d'état suit le fond de l'écran au premier plan : encre sur la craie et le soleil, claire ailleurs.
export const useSceneStatusBar = () => {
  // Le bandeau piste passe sous la barre d'état des écrans de travail : texte clair dans les deux thèmes.
  const { dark, work } = usePalette();
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(dark || work ? "light" : "dark");
    }, [dark, work]),
  );
};

// Les couloirs de la piste : deux lignes blanches, d'un bord à l'autre de l'écran.
const BandLanes = ({ bleed }: { bleed: number }) => (
  <View
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={{ gap: 6, marginHorizontal: -bleed, marginTop: space.xs }}
  >
    <View style={{ height: 2, backgroundColor: tokens.band.lane }} />
    <View style={{ height: 2, backgroundColor: tokens.band.lane }} />
  </View>
);

// Hors ligne ou envois en attente : l'état se lit sans chercher.
export const SyncBanner = () => {
  const router = useRouter();
  const p = usePalette();
  const pathname = usePathname();
  const online = useIsOnline();
  const ops = useOpQueue((s) => s.items.length - reviewRequiredOps(s.items).length);
  const blocked = useOpQueue((s) => reviewRequiredOps(s.items).length);
  const storageError = useOpQueue((s) => s.storageError);
  const flush = useOpQueue((s) => s.flush);
  const rejected = useOpQueue((s) => s.rejectedCount);
  const dismiss = useOpQueue((s) => s.dismissRejected);
  const uploads = useUploads((s) => s.items.length);
  const pending = ops + uploads;
  if (rejected > 0 && !storageError && blocked === 0) {
    return (
      <ListSurface style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingLeft: space.lg }}>
        <T variant="caption" style={{ flex: 1 }} accessibilityLiveRegion="polite">
          {m.mobile.validation.rejected}
        </T>
        <IconButton icon={X} label={m.common.close} onPress={dismiss} />
      </ListSurface>
    );
  }
  if (online && pending === 0 && blocked === 0 && !storageError) return null;
  const Icon = online ? CloudUpload : CloudOff;
  const parts = [
    online ? null : m.mobile.offline.banner,
    pending > 0 ? m.mobile.offline.pending(pending) : null,
    blocked > 0 ? m.offline.reviewPending(blocked) : null,
    storageError ? m.offline.deviceStorageError : null,
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
      <Icon size={18} color={p.status.partial} accessibilityElementsHidden importantForAccessibility="no" />
      <T variant="caption" accessibilityLiveRegion="polite" style={{ flex: 1 }}>
        {parts.join(" ")}
      </T>
      {blocked > 0 && pathname !== "/sync-review" ? (
        <Button compact variant="secondary" label={m.syncReview.open} onPress={() => router.push("/sync-review")} />
      ) : null}
      {storageError ? <IconButton icon={Repeat} label={m.offline.retry} onPress={() => void flush()} /> : null}
    </ListSurface>
  );
};

type TabScreenProps = {
  world?: WorldName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scrollProps?: ScrollViewProps;
};

// Écran d'onglet : sélecteur d'espace, titre, contenu défilant, tirer pour actualiser.
const TabInner = ({
  title,
  subtitle,
  right,
  children,
  refreshing,
  onRefresh,
  scrollProps,
}: Omit<TabScreenProps, "world">) => {
  useSceneStatusBar();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const pad = usePagePad();
  // L'indicateur ne suit que le geste de l'utilisateur, pas les actualisations d'arrière-plan.
  const [pulled, setPulled] = useState(false);
  useEffect(() => {
    if (!refreshing) setPulled(false);
  }, [refreshing]);
  const titleRow = (
    <>
      <SpaceSwitcher />
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <ScreenTitle title={title} plain={p.work} />
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
    </>
  );
  const header = (
    <>
      {titleRow}
      <LaneLine />
    </>
  );
  const bandHeader = (
    <View
      style={{
        marginHorizontal: -pad,
        paddingHorizontal: pad,
        paddingTop: space.sm,
        paddingBottom: space.md,
        gap: space.md,
        backgroundColor: tokens.band.background,
      }}
    >
      {titleRow}
      <BandLanes bleed={pad} />
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: p.work ? tokens.band.background : p.bg, paddingTop: insets.top }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: p.bg }}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          paddingTop: p.work ? 0 : space.sm,
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
        {p.work ? <Scene scene="piste">{bandHeader}</Scene> : header}
        <SyncBanner />
        {children}
      </ScrollView>
    </View>
  );
};

export const TabScreen = ({ world = "piste", ...rest }: TabScreenProps) => (
  <Scene scene={world}>
    <TabInner {...rest} />
  </Scene>
);

type StackScreenProps = {
  world?: WorldName;
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
}: Omit<StackScreenProps, "dark" | "world">) => {
  useSceneStatusBar();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  const pad = usePagePad();
  const content = {
    paddingTop: p.work ? space.lg : 0,
    paddingHorizontal: pad,
    paddingBottom: footer ? space.lg : insets.bottom + space.xxl,
    gap: space.lg,
  };
  return (
    <View style={{ flex: 1, backgroundColor: p.work ? tokens.band.background : p.bg, paddingTop: insets.top }}>
      <Scene scene={p.work ? "piste" : p.name}>
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
              <ScreenTitle title={title} plain={p.work} variant={p.world ? "title1" : "title2"} numberOfLines={2} />
            ) : null}
            {subtitle ? (
              <T variant="caption" tone="muted" numberOfLines={2}>
                {subtitle}
              </T>
            ) : null}
          </View>
          {right}
        </View>
        {p.work ? (
          <View style={{ paddingBottom: space.sm }}>
            <BandLanes bleed={0} />
          </View>
        ) : null}
        {!p.work && p.world && title ? (
          <View style={{ paddingHorizontal: pad, marginBottom: space.lg }}>
            <LaneLine />
          </View>
        ) : null}
      </Scene>
      {scroll ? (
        <ScrollView
          style={{ flex: 1, backgroundColor: p.bg }}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={content}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, backgroundColor: p.bg }, content]}>{children}</View>
      )}
      {footer ? (
        <View
          style={{
            backgroundColor: p.bg,
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

// `dark` : l'encre des écrans de tâche (vidéo, capture, mode séance), prioritaire sur le monde.
export const StackScreen = ({ dark, world = "work", ...rest }: StackScreenProps) => (
  <Scene scene={dark ? "encre" : world}>
    <StackInner {...rest} />
  </Scene>
);
