import type { SpaceSummary } from "@tartan/contracts";
import { isStaff } from "@tartan/domain";
import { create } from "zustand";

type SpaceState = {
  activeOrgId: string | null;
  setActive: (orgId: string) => void;
};

// Le club ouvert est temporaire. L'accueil habituel est le premier espace renvoyé par le serveur.
export const useSpaceStore = create<SpaceState>((set) => ({
  activeOrgId: null,
  setActive: (activeOrgId) => set({ activeOrgId }),
}));

export const pickSpace = (spaces: SpaceSummary[], activeOrgId: string | null): SpaceSummary | null =>
  spaces.find((s) => s.organizationId === activeOrgId) ?? spaces[0] ?? null;

// Le rôle découle de l'espace, jamais d'un choix à la connexion (§ 6.2).
export const homeFor = (space: SpaceSummary): "/today" | "/tracking" | null => {
  if (isStaff(space.role)) return "/tracking";
  if (space.role === "athlete") return "/today";
  return null;
};
