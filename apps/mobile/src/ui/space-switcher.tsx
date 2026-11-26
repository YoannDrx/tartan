import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { selectableSpaces } from "@tartan/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { ErrorState } from "./states";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useActiveSpace } from "../lib/queries";
import { spaceCaption } from "../lib/personal-space";
import { homeFor, useSpaceStore } from "../lib/space-store";
import { Check, ChevronsUpDown } from "./icons";
import { T } from "./primitives";
import { Sheet } from "./sheet";
import { radius, palettes, Scene, space, usePalette } from "./theme";

// Le carnet intégré ne demande aucun changement d’espace.
export const SpaceSwitcher = () => {
  const { me, space: active } = useActiveSpace();
  const setActive = useSpaceStore((s) => s.setActive);
  const router = useRouter();
  const p = usePalette();
  const card = palettes[p.cardScene];
  const [open, setOpen] = useState(false);
  const spaces = selectableSpaces(me.data?.spaces ?? []);
  const client = useQueryClient();
  const choose = useMutation({
    mutationFn: api.updatePreferences,
    onSuccess: (data, input) => {
      client.setQueryData(["me"], data);
      const chosen = data.spaces.find((s) => s.organizationId === input.homeOrganizationId);
      if (chosen) {
        setActive(chosen.organizationId);
        setOpen(false);
        router.replace(homeFor(chosen) ?? "/");
      }
    },
  });
  if (spaces.length < 2 || !active) return null;
  return (
    <>
      <Pressable
        testID="space-switcher"
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${m.settings.switchSpace} : ${active.organizationName}, ${spaceCaption(active)}`}
        style={({ pressed }) => ({
          minHeight: 44,
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          paddingHorizontal: space.md,
          borderRadius: radius.pill,
          backgroundColor: p.surface,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Scene scene={p.cardScene}>
          <T variant="smallStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
            {active.organizationName}
          </T>
          <T variant="caption" tone="muted">
            {spaceCaption(active)}
          </T>
          <ChevronsUpDown size={16} color={card.text} accessibilityElementsHidden importantForAccessibility="no" />
        </Scene>
      </Pressable>
      <Sheet visible={open} title={m.settings.switchSpace} onClose={() => setOpen(false)}>
        <View style={{ gap: space.sm }}>
          {choose.isError && <ErrorState error={choose.error} onRetry={() => choose.reset()} />}
          {spaces.map((s) => {
            const selected = s.organizationId === active.organizationId;
            return (
              <Pressable
                key={s.organizationId}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${s.organizationName}, ${spaceCaption(s)}`}
                disabled={choose.isPending}
                onPress={() => choose.mutate({ homeOrganizationId: s.organizationId })}
                style={({ pressed }) => ({
                  minHeight: 56,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                  paddingHorizontal: space.lg,
                  borderRadius: radius.card,
                  backgroundColor: card.surface,
                  borderWidth: selected ? 2 : 0,
                  borderColor: card.accent,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View style={{ flex: 1 }}>
                  <T variant="bodyStrong">{s.organizationName}</T>
                  <T variant="caption" tone="muted">
                    {spaceCaption(s)}
                  </T>
                </View>
                {selected ? (
                  <Check size={20} color={card.accent} accessibilityElementsHidden importantForAccessibility="no" />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
};
