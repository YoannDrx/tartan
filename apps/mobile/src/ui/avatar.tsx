import { avatarSource, initialsOf } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { useState } from "react";
import { Image, Text, useWindowDimensions, View } from "react-native";
import { PresetArt, presetLabel } from "./avatar-art";
import { textStyles, usePalette } from "./theme";

// Les tailles des avatars, les mêmes que sur le web. Un avatar touchable se pose dans une cible d'au moins 44 points.
export const AVATAR_SIZES = { xs: 24, sm: 32, md: 40, lg: 64, xl: 96, header: 48, portrait: 384 } as const;
export type AvatarSize = keyof typeof AVATAR_SIZES;

export type AvatarPerson = {
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  avatarPreset?: string | null;
};

// Le seul composant qui montre une personne : sa photo, sinon l'avatar choisi, sinon ses initiales.
// Décoratif par défaut, car le nom est écrit à côté ; `labelled` quand l'avatar est seul à désigner la personne.
export const Avatar = ({
  person,
  size = "sm",
  labelled = false,
  testID,
}: {
  person: AvatarPerson;
  size?: AvatarSize;
  labelled?: boolean;
  testID?: string;
}) => {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const px = size === "portrait" ? Math.min(384, width - 88) : AVATAR_SIZES[size];
  const [first, ...rest] = person.name.trim().split(/\s+/);
  const firstName = person.firstName ?? first ?? "";
  const lastName = person.lastName ?? rest.join(" ");
  const source = avatarSource({ ...person, firstName, lastName });
  // Une photo qui ne charge plus (hors ligne, supprimée) laisse la place aux initiales, jamais à un trou.
  const [broken, setBroken] = useState<string | null>(null);
  const photo = source.kind === "photo" && broken !== source.url ? source.url : null;
  const preset = source.kind === "preset" ? source.preset : null;
  const label = photo
    ? m.account.avatar.alt.photo(person.name)
    : preset
      ? m.account.avatar.alt.preset(person.name, presetLabel(preset))
      : m.account.avatar.alt.initials(person.name);
  const a11y = labelled
    ? { accessible: true, accessibilityRole: "image" as const, accessibilityLabel: label }
    : { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const };
  return (
    <View
      testID={testID}
      {...a11y}
      style={{
        width: px,
        height: px,
        borderRadius: px / 2,
        overflow: "hidden",
        backgroundColor: p.raised,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={{ width: px, height: px }}
          resizeMode="cover"
          onError={() => setBroken(photo)}
        />
      ) : preset ? (
        <PresetArt preset={preset} size={px} />
      ) : (
        <Text
          maxFontSizeMultiplier={1.2}
          style={[
            textStyles.smallStrong,
            {
              color: p.onRaised,
              fontSize: Math.max(12, Math.round(px * 0.36)),
              lineHeight: Math.round(Math.max(12, px * 0.36) * 1.2),
            },
          ]}
        >
          {initialsOf(firstName, lastName)}
        </Text>
      )}
    </View>
  );
};
