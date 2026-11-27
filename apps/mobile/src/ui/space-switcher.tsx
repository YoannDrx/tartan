import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { selectableSpaces } from "@tartan/domain";
import type { SpaceSummary } from "@tartan/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { playFeedback } from "../lib/feedback";
import { ErrorState } from "./states";
import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { useActiveSpace } from "../lib/queries";
import { spaceCaption } from "../lib/personal-space";
import { homeFor, useSpaceStore } from "../lib/space-store";
import { Check, ChevronDown } from "./icons";
import { T } from "./primitives";
import { Sheet } from "./sheet";
import { radius, palettes, Scene, space, usePalette } from "./theme";

// Hauteur du logotype dans l'en-tête ; les fichiers viennent de `scripts/build-logo.mjs`, tous hauts de 107 unités.
const BRAND_HEIGHT = 24;
const RATIO = { tartan: 816 / 214, coach: 787 / 224, athlete: 902 / 224 } as const;

const isAthlete = (space: Pick<SpaceSummary, "role">) => space.role === "athlete" || space.role === "guardian";

// « Tartan Coach » ou « Tartan Athlète » : le mot « Tartan », puis le rôle écrit dans la même police, à la même
// hauteur, l'initiale dessinée en couloirs comme le T. Clair sur la piste et en sombre, encre ailleurs.
const Lockup = ({ athlete, light }: { athlete: boolean; light: boolean }) => (
  <View
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
  >
    <Image
      accessibilityIgnoresInvertColors
      source={
        light ? require("../../assets/brand/wordmark-light.png") : require("../../assets/brand/wordmark-dark.png")
      }
      resizeMode="contain"
      style={{ height: BRAND_HEIGHT, width: BRAND_HEIGHT * RATIO.tartan }}
    />
    <Image
      accessibilityIgnoresInvertColors
      source={
        athlete
          ? light
            ? require("../../assets/brand/role-athlete-light.png")
            : require("../../assets/brand/role-athlete-dark.png")
          : light
            ? require("../../assets/brand/role-coach-light.png")
            : require("../../assets/brand/role-coach-dark.png")
      }
      resizeMode="contain"
      style={{ height: BRAND_HEIGHT, width: BRAND_HEIGHT * (athlete ? RATIO.athlete : RATIO.coach) }}
    />
  </View>
);

// L'initiale de l'espace, sur une pastille : on reconnaît l'espace avant d'en lire le nom.
const SpaceBadge = ({ space: s }: { space: SpaceSummary }) => {
  const p = usePalette();
  const card = palettes[p.cardScene];
  const staff = !isAthlete(s);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: staff ? card.accent : card.raised,
      }}
    >
      <T variant="bodyStrong" style={{ color: staff ? card.accentText : card.onRaised }}>
        {(s.organizationName.trim() || m.brand.name).charAt(0).toUpperCase()}
      </T>
    </View>
  );
};

// La marque de l'en-tête : « Tartan Coach », l'espace dessous. Un seul espace, elle ramène à l'accueil ; plusieurs,
// elle ouvre la liste des espaces. Le carnet intégré à la journée de l'athlète invité ne compte pas comme un espace.
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
  if (!active) return <View style={{ flex: 1 }} />;
  const several = spaces.length > 1;
  const brand = isAthlete(active) ? m.brand.athlete : m.brand.coach;

  return (
    <>
      <Pressable
        testID="space-switcher"
        accessibilityRole={several ? "button" : "link"}
        accessibilityLabel={
          several
            ? `${brand}, ${active.organizationName}, ${m.settings.switchSpace}`
            : `${brand}, ${active.organizationName}`
        }
        onPress={() => {
          if (several) {
            playFeedback("select");
            setOpen(true);
          } else router.replace(homeFor(active) ?? "/");
        }}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: 48,
          justifyContent: "center",
          gap: 3,
          opacity: pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <Lockup athlete={isAthlete(active)} light={p.work || p.dark} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <T variant="caption" numberOfLines={1} style={{ flexShrink: 1 }}>
            {active.organizationName}
          </T>
          {several ? (
            <ChevronDown size={14} color={p.text} accessibilityElementsHidden importantForAccessibility="no" />
          ) : null}
        </View>
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
                onPress={() => {
                  playFeedback("select");
                  if (selected) setOpen(false);
                  else choose.mutate({ homeOrganizationId: s.organizationId });
                }}
                style={({ pressed }) => ({
                  minHeight: 64,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.md,
                  paddingHorizontal: space.md,
                  borderRadius: radius.card,
                  backgroundColor: card.surface,
                  borderWidth: 2,
                  borderColor: selected ? card.accent : "transparent",
                  opacity: pressed ? 0.8 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                <Scene scene={p.cardScene}>
                  <SpaceBadge space={s} />
                  <View style={{ flex: 1 }}>
                    <T variant="bodyStrong" numberOfLines={1}>
                      {s.organizationName}
                    </T>
                    <T variant="caption" tone="muted">
                      {choose.isPending && choose.variables?.homeOrganizationId === s.organizationId
                        ? m.common.loading
                        : spaceCaption(s)}
                    </T>
                  </View>
                  {selected ? (
                    <Check size={20} color={card.accent} accessibilityElementsHidden importantForAccessibility="no" />
                  ) : null}
                </Scene>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </>
  );
};
