import type { Metadata } from "next";
import type { ReactNode } from "react";
import { m } from "@tartan/i18n";
import { requireSpace } from "@/features/shell/space";
import { SettingsFrame } from "@/features/settings/settings-frame";

export const metadata: Metadata = { title: m.settings.title };

// Le sommaire et ses rubriques partagent le bandeau et, sur ordinateur, la barre latérale.
export default async function ReglagesLayout({ children }: { children: ReactNode }) {
  const { space } = await requireSpace();
  return (
    <SettingsFrame role={space.role} spaceName={space.organizationName}>
      {children}
    </SettingsFrame>
  );
}
