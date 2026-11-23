import { route } from "@/lib/zod-route";
import { signupOptions } from "@/server/personal-space.service";

// Public : l'aiguillage d'un compte sans espace, sur le web comme dans l'app native, n'affiche que les choix permis.
// Deux réglages de la console, aucune donnée de personne.
export const GET = route.handler(async () => signupOptions());
