"use client";

import { w } from "@tartan/i18n/web";
import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Input } from "./field";

// Un champ de mot de passe qu'on peut relire avant d'envoyer : le bouton montre ou masque la saisie.
// Le collage et les gestionnaires de mots de passe passent tels quels (`autoComplete` vient de l'appelant).
export const PasswordInput = ({ className, ...props }: Omit<ComponentProps<"input">, "type">) => {
  const [visible, setVisible] = useState(false);
  const label = visible ? w.auth.hidePassword : w.auth.showPassword;
  return (
    <span className="relative block w-full">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-12", className)} />
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={visible}
        className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-button text-soft hover:text-inherit"
        onClick={() => setVisible((shown) => !shown)}
      >
        {visible ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
      </button>
    </span>
  );
};
