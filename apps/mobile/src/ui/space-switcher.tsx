import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useActiveSpace } from "../lib/queries";
import { homeFor, useSpaceStore } from "../lib/space-store";
import { Check, ChevronsUpDown } from "./icons";
import { T } from "./primitives";
import { Sheet } from "./sheet";
import { color, radius, space, usePalette } from "./theme";

// N'apparaît que si l'utilisateur a plusieurs espaces (§ 6.2).
export const SpaceSwitcher = () => {
  const { me, space: active } = useActiveSpace();
  const setActive = useSpaceStore((s) => s.setActive);
  const router = useRouter();
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const spaces = me.data?.spaces ?? [];
  if (spaces.length < 2 || !active) return null;
  return (
    <>
      <Pressable
        testID="space-switcher"
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${m.settings.switchSpace} : ${active.organizationName}, ${m.roles[active.role]}`}
        style={({ pressed }) => ({
          minHeight: 44,
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          paddingHorizontal: space.md,
          borderRadius: radius.pill,
          backgroundColor: color.surface,
          borderWidth: 1,
          borderColor: p.border,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <T variant="smallStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
          {active.organizationName}
        </T>
        <T variant="caption" tone="muted">
          {m.roles[active.role]}
        </T>
        <ChevronsUpDown size={16} color={p.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
      </Pressable>
      <Sheet visible={open} title={m.settings.switchSpace} onClose={() => setOpen(false)}>
        <View style={{ gap: space.sm }}>
          {spaces.map((s) => {
            const selected = s.organizationId === active.organizationId;
            return (
              <Pressable
                key={s.organizationId}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${s.organizationName}, ${m.roles[s.role]}`}
                onPress={() => {
                  setActive(s.organizationId);
                  setOpen(false);
                  const home = homeFor(s);
                  router.replace(home ?? "/");
                }}
                style={({ pressed }) => ({
                  minHeight: 56,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                  paddingHorizontal: space.lg,
                  borderRadius: radius.card,
                  backgroundColor: color.surface,
                  borderWidth: 1,
                  borderColor: selected ? color.ink : p.border,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View style={{ flex: 1 }}>
                  <T variant="bodyStrong">{s.organizationName}</T>
                  <T variant="caption" tone="muted">
                    {m.roles[s.role]}
                  </T>
                </View>
                {selected ? (
                  <Check size={20} color={color.ink} accessibilityElementsHidden importantForAccessibility="no" />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
};
