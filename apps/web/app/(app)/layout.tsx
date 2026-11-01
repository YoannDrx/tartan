import type { ReactNode } from "react";
import { AppShell } from "@/features/shell/app-shell";
import { requireSpace } from "@/features/shell/space";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { spaces, space, staff } = await requireSpace();
  return (
    <AppShell staff={staff} spaces={spaces} space={space}>
      {children}
    </AppShell>
  );
}
