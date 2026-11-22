import { m } from "@tartan/i18n";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { AlertTriangle, Check, ChevronDown } from "../ui/icons";
import { T } from "../ui/primitives";
import { radius, space, textStyles, TOUCH, usePalette } from "../ui/theme";

/**
 * Un repli de l'écran : son titre, ce qu'il contient déjà, et le chevron qui dit qu'il s'ouvre. 44 points de haut,
 * l'état ouvert ou fermé est annoncé au lecteur d'écran.
 */
export function Fold({
  title,
  detail,
  initiallyOpen = false,
  forceOpen = false,
  keepMounted = false,
  testID,
  children,
}: {
  title: string;
  detail?: string | null;
  initiallyOpen?: boolean;
  /** Ouvert tant qu'il y a quelque chose à y faire, quoi qu'ait choisi le coach. */
  forceOpen?: boolean;
  /** Le contenu reste monté, caché : ce qu'il calcule (une phase prête, par exemple) vaut même replié. */
  keepMounted?: boolean;
  testID?: string;
  children: ReactNode;
}) {
  const p = usePalette();
  const [chosen, setOpen] = useState(initiallyOpen);
  const open = chosen || forceOpen;
  const body = { gap: space.md, paddingBottom: space.md } as const;
  return (
    <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: p.border }}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={detail ? `${title}, ${detail}` : title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!chosen)}
        style={({ pressed }) => ({
          minHeight: TOUCH,
          paddingVertical: space.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <T variant="bodyStrong" style={{ flex: 1 }}>
          {title}
        </T>
        {detail ? (
          <T variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {detail}
          </T>
        ) : null}
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <ChevronDown size={20} color={p.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
        </View>
      </Pressable>
      {keepMounted ? (
        <View
          style={[body, { display: open ? "flex" : "none" }]}
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? "auto" : "no-hide-descendants"}
        >
          {children}
        </View>
      ) : open ? (
        <View style={body}>{children}</View>
      ) : null}
    </View>
  );
}

/** Une pastille à bascule : 44 points de haut, l'état se lit au fond, à la coche et par l'état « sélectionné ». */
export function Pill({
  label,
  pressed,
  onPress,
  disabled,
  accessibilityLabel,
  testID,
}: {
  label: string;
  pressed: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: pressed, disabled: Boolean(disabled) }}
      style={({ pressed: touched }) => ({
        minHeight: TOUCH,
        paddingHorizontal: space.lg,
        borderRadius: radius.pill,
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        backgroundColor: pressed ? p.accent : p.outlined ? "transparent" : p.surface,
        borderWidth: pressed ? 0 : p.outlined ? 2 : 1,
        borderColor: p.outlined ? p.lane : p.controlLine,
        opacity: disabled ? 0.55 : touched ? 0.85 : 1,
      })}
    >
      {pressed ? (
        <Check size={16} color={p.accentText} accessibilityElementsHidden importantForAccessibility="no" />
      ) : null}
      <Text
        maxFontSizeMultiplier={1.6}
        style={[textStyles.smallStrong, { color: pressed ? p.accentText : p.text, flexShrink: 1 }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Une rangée de pastilles qui passe à la ligne. */
export const PillRow = ({ children }: { children: ReactNode }) => (
  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>{children}</View>
);

/** Un point « À vérifier » : le pictogramme, le mot, puis ce qu'il faut regarder. Jamais la couleur seule. */
export function CheckLine({ children }: { children: string }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
      <View style={{ paddingTop: 2 }}>
        <AlertTriangle size={16} color={p.text} accessibilityElementsHidden importantForAccessibility="no" />
      </View>
      <T variant="small" style={{ flex: 1 }}>
        <T variant="smallStrong">{`${m.aiPlanner.screen.toCheck}. `}</T>
        {children}
      </T>
    </View>
  );
}
