"use client";

import { m } from "@tartan/i18n";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { applyThemePreference, themePreferences, type ThemePreference } from "@/features/shell/theme";

export const ThemeChoice = ({ initial }: { initial: ThemePreference }) => {
  const [theme, setTheme] = useState(initial);
  const choose = (next: ThemePreference) => {
    setTheme(next);
    applyThemePreference(next);
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{m.appearance.title}</legend>
      <p className="text-soft">{m.appearance.hint}</p>
      <div className="flex flex-wrap gap-2">
        {themePreferences.map((option) => (
          <label
            key={option}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-second-line px-4 font-semibold",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
              theme === option ? "bg-cta text-on-cta" : "bg-second hover:bg-second-hover",
            )}
          >
            <input
              type="radio"
              name="theme"
              className="sr-only"
              checked={theme === option}
              onChange={() => choose(option)}
            />
            {m.appearance[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
};
