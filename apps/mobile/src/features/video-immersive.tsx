import { m } from "@tartan/i18n";
import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  View,
  useWindowDimensions,
  type AccessibilityActionEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  dragSheet,
  growSheet,
  immersiveLayout,
  panelWidth,
  SHEET_SHARE,
  shrinkSheet,
  type SheetHeight,
} from "../lib/video-immersive";
import { ChevronDown, ChevronUp, PanelRightClose, PanelRightOpen, X } from "../ui/icons";
import { IconButton, T } from "../ui/primitives";
import { GUTTER, radius, Scene, space, usePalette } from "../ui/theme";

const t = m.nativeVideo;
const HEADER = 52;
const HANDLE = 56;
// L'image garde toujours au moins cette hauteur : la feuille entière ne la masque pas.
const STAGE_MIN = 180;

/**
 * L'analyse en plein écran (DESIGN.md) : l'image occupe la scène, l'éditeur reste à portée. En portrait, une feuille en
 * bas à trois hauteurs, réglable par la poignée ou par deux boutons ; en paysage et sur écran large, un panneau à droite,
 * repliable en rail. Le retour d'Android et le bouton du haut quittent le plein écran, pas l'écran.
 */
export function ImmersiveAnalysis({
  onExit,
  stage,
  controls,
  editor,
  sheet,
  onSheet,
}: {
  onExit: () => void;
  stage: ReactNode;
  controls: ReactNode;
  editor: ReactNode;
  sheet: SheetHeight;
  onSheet: (height: SheetHeight) => void;
}) {
  const p = usePalette();
  const size = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = immersiveLayout(size);
  const [collapsed, setCollapsed] = useState(false);
  const [controlsHeight, setControlsHeight] = useState(0);
  const height = size.height - insets.top - insets.bottom;
  const available = Math.max(0, height - HEADER - HANDLE - controlsHeight - STAGE_MIN);
  const sheetHeight = HANDLE + SHEET_SHARE[sheet] * available;

  const exit = (
    <View style={{ height: HEADER, flexDirection: "row", alignItems: "center", paddingHorizontal: space.xs }}>
      <IconButton testID="video-exit-fullscreen" icon={X} label={t.exitFullscreen} onPress={onExit} />
    </View>
  );

  return (
    <Modal
      visible
      animationType="none"
      onRequestClose={onExit}
      supportedOrientations={["portrait", "landscape"]}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Scene scene="encre">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            flex: 1,
            backgroundColor: p.bg,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          }}
        >
          {layout === "side" ? (
            <View style={{ flex: 1, flexDirection: "row" }}>
              <View style={{ flex: 1 }}>
                {exit}
                <View style={{ flex: 1 }}>{stage}</View>
                <View style={{ padding: space.md, gap: space.sm }}>{controls}</View>
              </View>
              <View
                testID="video-editor-panel"
                style={{ width: panelWidth(size.width, collapsed), borderLeftWidth: 1, borderColor: p.border }}
              >
                <View style={{ height: HEADER, flexDirection: "row", alignItems: "center", gap: space.sm }}>
                  <IconButton
                    testID="video-panel-toggle"
                    icon={collapsed ? PanelRightOpen : PanelRightClose}
                    label={collapsed ? t.sheet.expand : t.sheet.collapse}
                    onPress={() => setCollapsed(!collapsed)}
                  />
                  {collapsed ? null : <T variant="bodyStrong">{t.editor}</T>}
                </View>
                {collapsed ? null : (
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ padding: space.md, gap: space.lg }}
                  >
                    {editor}
                  </ScrollView>
                )}
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              {exit}
              <View style={{ flex: 1, minHeight: STAGE_MIN }}>{stage}</View>
              <View
                onLayout={(event) => setControlsHeight(event.nativeEvent.layout.height)}
                style={{ paddingHorizontal: GUTTER, paddingVertical: space.sm, gap: space.sm }}
              >
                {controls}
              </View>
              <View
                testID="video-editor-sheet"
                style={{
                  height: sheetHeight,
                  borderTopLeftRadius: radius.hero,
                  borderTopRightRadius: radius.hero,
                  borderWidth: 1,
                  borderBottomWidth: 0,
                  borderColor: p.border,
                  backgroundColor: p.surface,
                }}
              >
                <SheetHandle sheet={sheet} available={available} onSheet={onSheet} />
                {sheet === "rail" ? null : (
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: space.lg, gap: space.lg }}
                  >
                    {editor}
                  </ScrollView>
                )}
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Scene>
    </Modal>
  );
}

// La poignée de la feuille : un glissement la pose sur la hauteur la plus proche ; deux boutons font de même, et le
// lecteur d'écran l'ajuste comme un réglage.
function SheetHandle({
  sheet,
  available,
  onSheet,
}: {
  sheet: SheetHeight;
  available: number;
  onSheet: (height: SheetHeight) => void;
}) {
  const p = usePalette();
  const latest = useRef({ sheet, available, onSheet });
  latest.current = { sheet, available, onSheet };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, gesture) => Math.abs(gesture.dy) > 4,
        onPanResponderRelease: (_e, gesture) => {
          const { sheet: current, available: room, onSheet: set } = latest.current;
          set(dragSheet(current, gesture.dy, room));
        },
      }),
    [],
  );
  const set = (next: SheetHeight) => {
    onSheet(next);
    AccessibilityInfo.announceForAccessibility(t.sheet.heights[next]);
  };
  return (
    <View style={{ height: HANDLE, flexDirection: "row", alignItems: "center", paddingHorizontal: space.sm }}>
      <View
        {...pan.panHandlers}
        testID="video-sheet-handle"
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t.sheet.handle}
        accessibilityValue={{ text: t.sheet.heights[sheet] }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event: AccessibilityActionEvent) =>
          set(event.nativeEvent.actionName === "increment" ? growSheet(sheet) : shrinkSheet(sheet))
        }
        style={{ flex: 1, height: HANDLE, justifyContent: "center", gap: space.xs }}
      >
        <View
          style={{ alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: p.textMuted }}
        />
        <T variant="smallStrong" style={{ paddingLeft: space.sm }}>
          {t.editor}
        </T>
      </View>
      <IconButton
        testID="video-sheet-shrink"
        icon={ChevronDown}
        label={t.sheet.shrink}
        disabled={sheet === "rail"}
        onPress={() => set(shrinkSheet(sheet))}
      />
      <IconButton
        testID="video-sheet-grow"
        icon={ChevronUp}
        label={t.sheet.grow}
        disabled={sheet === "full"}
        onPress={() => set(growSheet(sheet))}
      />
    </View>
  );
}
