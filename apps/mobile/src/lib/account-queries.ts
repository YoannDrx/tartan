import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OnboardingPatch, OnboardingResponse } from "@tartan/contracts";
import { api } from "./api";
import { applyOnboardingPatch } from "./onboarding";
import { useSession } from "./session-store";

// Les moyens de connexion du compte : jamais en cache persisté, ils changent d'un appareil à l'autre.
export const useSignInMethods = (enabled = true) => {
  const signedIn = useSession((s) => s.status === "signed-in");
  return useQuery({
    queryKey: ["sign-in-methods"],
    queryFn: api.signInMethods,
    enabled: enabled && signedIn,
    staleTime: 0,
  });
};

// Les premiers pas du membre dans l'espace actif. L'état vit côté serveur : ce qui est refermé ici l'est partout.
export const useOnboarding = (orgId: string) =>
  useQuery({ queryKey: ["onboarding", orgId], queryFn: () => api.onboarding(orgId), enabled: Boolean(orgId) });

// Un geste (refermer, écarter, reprendre) se voit tout de suite ; un refus du serveur rend l'état d'avant.
export const useUpdateOnboarding = (orgId: string) => {
  const client = useQueryClient();
  const key = ["onboarding", orgId];
  return useMutation({
    mutationFn: (patch: OnboardingPatch) => api.updateOnboarding(orgId, patch),
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<OnboardingResponse>(key);
      if (previous) client.setQueryData(key, applyOnboardingPatch(previous, patch, new Date().toISOString()));
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
    },
    onSuccess: (next) => client.setQueryData(key, next),
  });
};

export const useAthleteWelcome = (orgId: string, enabled: boolean) =>
  useQuery({
    queryKey: ["athlete-welcome", orgId],
    queryFn: () => api.athleteWelcome(orgId),
    enabled: Boolean(orgId) && enabled,
  });
