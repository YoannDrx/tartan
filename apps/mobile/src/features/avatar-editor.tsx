import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@tartan/api-client";
import { AVATAR_PRESETS, type AvatarPreset, type MeResponse } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { File } from "expo-file-system";
import { PortraitEditor } from "./portrait-editor";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, Pressable, View } from "react-native";
import { api } from "../lib/api";
import { pickAvatarPhoto } from "../lib/avatar-upload";
import { errorMessage } from "../lib/errors";
import { Avatar } from "../ui/avatar";
import { PresetArt, presetLabel } from "../ui/avatar-art";
import { Camera, Images, Plus, Trash, Users } from "../ui/icons";
import { Button, Card, SectionTitle, T } from "../ui/primitives";
import { Sheet } from "../ui/sheet";
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

// Un bouton rond posé sur le bord du portrait, à 45° : son centre est sur le cercle, à 14,6 % du coin du carré.
// Un anneau de la couleur de la carte le détache de l'image, comme s'il y était incrusté.
const EDGE = 0.85355;
const RING = 4;
const ADD = 56;
const REMOVE = 48;
// Le temps d'annuler une suppression : rien ne part au serveur avant.
const UNDO_MS = 5000;

const EdgeButton = ({
  testID,
  label,
  icon: Icon,
  size,
  x,
  y,
  ring,
  accent,
  disabled,
  onPress,
}: {
  testID: string;
  label: string;
  icon: typeof Plus;
  size: number;
  x: number;
  y: number;
  ring: string;
  accent?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) => {
  const p = usePalette();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => ({
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: RING,
        borderColor: ring,
        backgroundColor: accent ? p.accent : p.raised,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      })}
    >
      <Icon
        size={accent ? 26 : 20}
        color={accent ? p.accentText : p.onRaised}
        strokeWidth={accent ? 2.6 : 2.2}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
};

// La photo de profil : un grand rond, et deux boutons sur son bord. Le « + » ouvre un menu (pellicule, appareil,
// avatar), la poubelle revient aux initiales après cinq secondes où l'on peut annuler. Toucher la photo la recadre.
export const AvatarEditor = ({ me }: { me: MeResponse }) => {
  const client = useQueryClient();
  const p = usePalette();
  const [source, setSource] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<"closed" | "actions" | "gallery">("closed");
  // `removing` : la suppression est demandée, l'aperçu montre déjà les initiales ; `pending` : « Annuler » est proposé.
  const [removing, setRemoving] = useState<"photo" | "preset" | null>(null);
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [side, setSide] = useState(0);
  const name = [me.firstName, me.lastName].filter(Boolean).join(" ") || me.email;
  const latest = useRef(me);
  latest.current = me;
  const saved = (next: MeResponse, message: string) => {
    client.setQueryData(["me"], next);
    setError(null);
    setNotice(message);
  };

  const photo = useMutation({
    mutationFn: async (from: "library" | "camera" | "current") => {
      if (from === "current" && me.avatarUrl) {
        const response = await fetch(me.avatarUrl);
        if (!response.ok) throw new Error();
        const blob = await response.blob();
        if (blob.size > 12 * 1024 * 1024) throw new Error();
        const uri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error());
          reader.readAsDataURL(blob);
        });
        return { kind: "edit" as const, uri };
      }
      if (from === "current") return { kind: "unreadable" as const };
      const picked = await pickAvatarPhoto(from);
      if (picked.kind !== "picked") return picked;
      return { kind: "edit" as const, uri: `data:image/jpeg;base64,${await new File(picked.uri).base64()}` };
    },
    onMutate: () => {
      setNotice(null);
      setError(null);
    },
    onSuccess: (outcome) => {
      if (outcome.kind === "edit") setSource(outcome.uri);
      else if (outcome.kind === "denied") setError(m.account.avatar.permissionCamera);
      else if (outcome.kind === "unreadable") setError(m.account.avatar.unreadable);
    },
    // Le refus du serveur dit quoi faire ; une panne réseau, elle, ne dit rien d'utile.
    onError: (failure) => setError(failure instanceof ApiError ? errorMessage(failure) : m.account.avatar.uploadFailed),
  });

  const toInitials = (who: MeResponse) =>
    api.updateProfile({
      firstName: who.firstName ?? "",
      lastName: who.lastName ?? "",
      avatarPreset: null,
      avatarUrl: null,
    });
  const choose = useMutation({
    mutationFn: (preset: AvatarPreset | null) =>
      preset
        ? api.updateProfile({ firstName: me.firstName ?? "", lastName: me.lastName ?? "", avatarPreset: preset })
        : toInitials(me),
    onMutate: () => {
      setNotice(null);
      setError(null);
    },
    onSuccess: (next, preset) => {
      setMenu("closed");
      setRemoving(null);
      saved(next, preset ? m.account.avatar.presetSaved : m.account.avatar.initialsSaved);
    },
    onError: (failure) => {
      setRemoving(null);
      setError(errorMessage(failure));
    },
  });

  // Quitter l'écran ou l'application pendant les cinq secondes confirme la suppression : elle part tout de suite.
  useEffect(() => {
    const flush = () => {
      if (timer.current === undefined) return;
      clearTimeout(timer.current);
      timer.current = undefined;
      void toInitials(latest.current)
        .then((next) => client.setQueryData(["me"], next))
        .catch(() => undefined);
    };
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") flush();
    });
    return () => {
      subscription.remove();
      flush();
    };
  }, [client]);

  const busy = photo.isPending || choose.isPending;
  const hasPhoto = Boolean(me.avatarUrl) && !removing;
  const hasPreset = !me.avatarUrl && Boolean(me.avatarPreset) && !removing;
  const current = me.avatarUrl ? null : (me.avatarPreset ?? null);

  const remove = () => {
    const kind = hasPhoto ? "photo" : "preset";
    setNotice(null);
    setError(null);
    setRemoving(kind);
    setPending(true);
    AccessibilityInfo.announceForAccessibility(
      kind === "photo" ? m.account.avatar.photoRemoved : m.account.avatar.presetRemoved,
    );
    timer.current = setTimeout(() => {
      timer.current = undefined;
      setPending(false);
      choose.mutate(null);
    }, UNDO_MS);
  };
  const undo = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    setPending(false);
    setRemoving(null);
    setNotice(m.account.avatar.restored);
  };
  // Le sélecteur du système ne s'ouvre pas par-dessus une feuille qui se ferme : on la ferme d'abord.
  const pick = (from: "library" | "camera") => {
    setMenu("closed");
    setTimeout(() => photo.mutate(from), 350);
  };

  const center = side * EDGE;
  const left = side * (1 - EDGE);
  return (
    <View style={{ gap: space.sm }}>
      {source && (
        <PortraitEditor
          source={source}
          onClose={() => setSource(null)}
          onSaved={(next) => {
            setSource(null);
            saved(next, m.account.avatar.saved);
          }}
        />
      )}
      <SectionTitle>{m.account.avatar.section}</SectionTitle>
      <Card>
        <View style={{ alignItems: "center", gap: space.lg }}>
          <View onLayout={(event) => setSide(event.nativeEvent.layout.width)} style={{ position: "relative" }}>
            <Avatar
              testID="avatar-current"
              person={{
                name,
                firstName: me.firstName,
                lastName: me.lastName,
                avatarUrl: removing ? null : me.avatarUrl,
                avatarPreset: removing ? null : me.avatarPreset,
              }}
              size="portrait"
              labelled
            />
            {hasPhoto && side > 0 ? (
              <Pressable
                testID="avatar-recrop"
                onPress={() => photo.mutate("current")}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={m.account.avatar.recrop}
                style={{ position: "absolute", top: 0, left: 0, width: side, height: side, borderRadius: side / 2 }}
              />
            ) : null}
            {(hasPhoto || hasPreset) && side > 0 ? (
              <EdgeButton
                testID="avatar-initials"
                label={hasPhoto ? m.account.avatar.removePhoto : m.account.avatar.removePreset}
                icon={Trash}
                size={REMOVE}
                x={left}
                y={center}
                ring={p.surface}
                disabled={busy}
                onPress={remove}
              />
            ) : null}
            {side > 0 ? (
              <EdgeButton
                testID="avatar-add"
                label={m.account.avatar.change}
                icon={Plus}
                size={ADD}
                x={center}
                y={center}
                ring={p.surface}
                accent
                disabled={busy}
                onPress={() => setMenu("actions")}
              />
            ) : null}
          </View>
          <View accessibilityLiveRegion="polite" style={{ alignItems: "center", gap: space.xs, minHeight: TOUCH }}>
            {pending ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <T variant="small">
                  {removing === "photo" ? m.account.avatar.photoRemoved : m.account.avatar.presetRemoved}
                </T>
                <Button testID="avatar-undo" label={m.account.avatar.undo} variant="ghost" compact onPress={undo} />
              </View>
            ) : (
              <T variant="small" tone="muted" style={{ textAlign: "center" }}>
                {hasPhoto ? `${m.account.avatar.recropHint} ` : ""}
                {m.account.avatar.detail}
              </T>
            )}
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
        </View>
      </Card>
      <Sheet
        visible={menu !== "closed"}
        title={menu === "gallery" ? m.account.avatar.choose : m.account.avatar.change}
        onClose={() => setMenu("closed")}
      >
        {menu === "gallery" ? (
          <>
            <T variant="caption" tone="muted">
              {m.account.avatar.galleryDetail}
            </T>
            {(["group", "animals"] as const).map((family) => (
              <View key={family} style={{ gap: space.sm }}>
                <T variant="smallStrong" heading>
                  {m.account.avatar[family]}
                </T>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                  {GALLERY[family].map((preset) => (
                    <PresetTile
                      key={preset}
                      preset={preset}
                      selected={current === preset}
                      disabled={busy}
                      onPress={() => choose.mutate(preset)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </>
        ) : (
          <View style={{ gap: space.sm }}>
            <Button
              testID="avatar-library"
              label={m.account.avatar.fromLibrary}
              icon={Images}
              variant="secondary"
              disabled={busy}
              onPress={() => pick("library")}
            />
            <Button
              testID="avatar-camera"
              label={m.account.avatar.fromCamera}
              icon={Camera}
              variant="secondary"
              disabled={busy}
              onPress={() => pick("camera")}
            />
            <Button
              testID="avatar-choose"
              label={m.account.avatar.choose}
              icon={Users}
              variant="secondary"
              disabled={busy}
              onPress={() => setMenu("gallery")}
            />
            <T variant="caption" tone="muted">
              {m.account.avatar.cropHint}
            </T>
          </View>
        )}
      </Sheet>
    </View>
  );
};
