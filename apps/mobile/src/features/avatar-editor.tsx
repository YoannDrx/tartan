import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@tartan/api-client";
import { AVATAR_PRESETS, type AvatarPreset, type MeResponse } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { api } from "../lib/api";
import { pickAvatarPhoto, uploadAvatarPhoto } from "../lib/avatar-upload";
import { errorMessage } from "../lib/errors";
import { Avatar } from "../ui/avatar";
import { PresetArt, presetLabel } from "../ui/avatar-art";
import { Camera, Images } from "../ui/icons";
import { Button, Card, SectionTitle, T } from "../ui/primitives";
import { radius, space, TOUCH, usePalette } from "../ui/theme";

const GALLERY = {
  group: AVATAR_PRESETS.filter((preset) => preset.startsWith("athlete:")),
  animals: AVATAR_PRESETS.filter((preset) => preset.startsWith("animal:")),
};
const TILE = 64;

const PresetTile = ({
  preset,
  selected,
  disabled,
  onPress,
}: {
  preset: AvatarPreset;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) => {
  const p = usePalette();
  return (
    <Pressable
      testID={`avatar-preset-${preset.replace(":", "-")}`}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={presetLabel(preset)}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => ({
        width: Math.max(TILE + 8, TOUCH),
        height: Math.max(TILE + 8, TOUCH),
        borderRadius: radius.pill,
        borderWidth: 3,
        borderColor: selected ? p.focus : "transparent",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.55 : pressed ? 0.8 : 1,
      })}
    >
      <View style={{ width: TILE, height: TILE, borderRadius: TILE / 2, overflow: "hidden" }}>
        <PresetArt preset={preset} size={TILE} />
      </View>
    </Pressable>
  );
};

// La photo de profil : la photo du téléphone recadrée en carré, un avatar de la galerie, ou les initiales.
export const AvatarEditor = ({ me }: { me: MeResponse }) => {
  const client = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const name = [me.firstName, me.lastName].filter(Boolean).join(" ") || me.email;
  const saved = (next: MeResponse, message: string) => {
    client.setQueryData(["me"], next);
    setError(null);
    setNotice(message);
  };

  const photo = useMutation({
    mutationFn: async (from: "library" | "camera") => {
      const picked = await pickAvatarPhoto(from);
      if (picked.kind !== "picked") return picked;
      return { kind: "saved" as const, me: await uploadAvatarPhoto(picked.uri) };
    },
    onMutate: () => {
      setNotice(null);
      setError(null);
    },
    onSuccess: (outcome) => {
      if (outcome.kind === "saved") saved(outcome.me, m.account.avatar.saved);
      else if (outcome.kind === "denied") setError(m.account.avatar.permissionCamera);
      else if (outcome.kind === "unreadable") setError(m.account.avatar.unreadable);
    },
    // Le refus du serveur dit quoi faire ; une panne réseau, elle, ne dit rien d'utile.
    onError: (failure) => setError(failure instanceof ApiError ? errorMessage(failure) : m.account.avatar.uploadFailed),
  });

  const choose = useMutation({
    mutationFn: (preset: AvatarPreset | null) =>
      api.updateProfile({
        firstName: me.firstName ?? "",
        lastName: me.lastName ?? "",
        ...(preset ? { avatarPreset: preset } : { avatarPreset: null, avatarUrl: null }),
      }),
    onMutate: () => {
      setNotice(null);
      setError(null);
    },
    onSuccess: (next, preset) => saved(next, preset ? m.account.avatar.presetSaved : m.account.avatar.initialsSaved),
    onError: (failure) => setError(errorMessage(failure)),
  });

  const busy = photo.isPending || choose.isPending;
  const current = me.avatarPreset ?? null;

  return (
    <View style={{ gap: space.sm }}>
      <SectionTitle>{m.account.avatar.section}</SectionTitle>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
          <Avatar
            testID="avatar-current"
            person={{
              name,
              firstName: me.firstName,
              lastName: me.lastName,
              avatarUrl: me.avatarUrl,
              avatarPreset: me.avatarPreset,
            }}
            size="xl"
            labelled
          />
          <T variant="small" tone="muted" style={{ flex: 1 }}>
            {m.account.avatar.detail}
          </T>
        </View>
        <Button
          testID="avatar-library"
          label={m.account.avatar.fromLibrary}
          icon={Images}
          variant="secondary"
          loading={photo.isPending && photo.variables === "library"}
          disabled={busy}
          onPress={() => photo.mutate("library")}
        />
        <Button
          testID="avatar-camera"
          label={m.account.avatar.fromCamera}
          icon={Camera}
          variant="secondary"
          loading={photo.isPending && photo.variables === "camera"}
          disabled={busy}
          onPress={() => photo.mutate("camera")}
        />
        <T variant="caption" tone="muted">
          {m.account.avatar.cropHint}
        </T>
        {me.avatarUrl || me.avatarPreset ? (
          <Button
            testID="avatar-initials"
            label={m.account.avatar.toInitials}
            variant="ghost"
            compact
            disabled={busy}
            style={{ alignSelf: "flex-start", paddingHorizontal: 0 }}
            onPress={() => choose.mutate(null)}
          />
        ) : null}
        <View accessibilityLiveRegion="polite">
          {photo.isPending ? <T variant="caption">{m.account.avatar.saving}</T> : null}
          {notice ? (
            <T testID="avatar-notice" variant="caption">
              {notice}
            </T>
          ) : null}
          {error ? (
            <T variant="caption" tone="danger">
              {error}
            </T>
          ) : null}
        </View>
      </Card>
      <SectionTitle>{m.account.avatar.galleryTitle}</SectionTitle>
      <T variant="caption" tone="muted">
        {m.account.avatar.galleryDetail}
      </T>
      {(["group", "animals"] as const).map((family) => (
        <Card key={family}>
          <T variant="smallStrong" heading>
            {m.account.avatar[family]}
          </T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
            {GALLERY[family].map((preset) => (
              <PresetTile
                key={preset}
                preset={preset}
                selected={current === preset && !me.avatarUrl}
                disabled={busy}
                onPress={() => choose.mutate(preset)}
              />
            ))}
          </View>
        </Card>
      ))}
    </View>
  );
};
