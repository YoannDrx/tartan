import { avatarSource } from "@tartan/domain";
import { w } from "@tartan/i18n/web";
import Image from "next/image";
import { PresetArt, presetLabel } from "@/components/avatar-art";
import { cn } from "@/lib/cn";

// Les tailles des avatars, partout les mêmes. Cliquable, un avatar se pose dans une cible d'au moins 44 px.
const SIZES = {
  xs: { box: "size-6", text: "text-[12px]", px: 24 },
  sm: { box: "size-8", text: "text-[12px]", px: 32 },
  md: { box: "size-10", text: "text-[14px]", px: 40 },
  lg: { box: "size-16", text: "text-[22px]", px: 64 },
  xl: { box: "size-24", text: "text-[32px]", px: 96 },
} as const;
export type AvatarSize = keyof typeof SIZES;

export type AvatarPerson = {
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  avatarPreset?: string | null;
};

// Une personne : sa photo, sinon l'avatar qu'elle a choisi, sinon ses initiales.
// Décoratif par défaut, car le nom est écrit à côté ; `labelled` quand l'avatar est seul à désigner la personne.
export const Avatar = ({
  person,
  size = "sm",
  labelled = false,
  className,
}: {
  person: AvatarPerson;
  size?: AvatarSize;
  labelled?: boolean;
  className?: string;
}) => {
  const s = SIZES[size];
  const [first, ...rest] = person.name.trim().split(/\s+/);
  const source = avatarSource({
    ...person,
    firstName: person.firstName ?? first ?? "",
    lastName: person.lastName ?? rest.join(" "),
  });
  const box = cn("relative inline-flex shrink-0 overflow-hidden rounded-full", s.box, className);
  if (source.kind === "photo") {
    return (
      <span className={cn(box, "bg-card-raised")} aria-hidden={labelled ? undefined : true}>
        <Image
          src={source.url}
          alt={labelled ? w.profile.alt.photo(person.name) : ""}
          fill
          sizes={`${s.px}px`}
          className="object-cover"
          unoptimized
        />
      </span>
    );
  }
  if (source.kind === "preset") {
    return (
      <span
        className={box}
        {...(labelled
          ? { role: "img", "aria-label": w.profile.alt.preset(person.name, presetLabel(source.preset)) }
          : { "aria-hidden": true })}
      >
        <PresetArt preset={source.preset} />
      </span>
    );
  }
  // Les initiales sont posées par la feuille de styles, pas écrites dans la page : un bouton qui porte l'avatar
  // garde son propre nom accessible (« Réglages ») sans que ces lettres visibles s'y ajoutent.
  return (
    <span
      data-initials={source.initials}
      className={cn(
        box,
        "items-center justify-center bg-card-raised font-semibold leading-none text-fg before:content-[attr(data-initials)]",
        s.text,
      )}
      {...(labelled ? { role: "img", "aria-label": w.profile.alt.initials(person.name) } : { "aria-hidden": true })}
    />
  );
};
