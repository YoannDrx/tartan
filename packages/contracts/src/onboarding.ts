import { z } from "zod";
import { uuid } from "./session";

// Les premiers pas d'un membre dans un espace, partagés par le web et le mobile
// (`GET` et `PATCH /api/v1/orgs/[orgId]/onboarding`). Les étapes obligatoires sont déduites des faits de l'espace ;
// seul ce que les faits ne disent pas s'écrit : tour vu, accueil vu, carte refermée, étapes écartées, repères vus.

export const coachStepKey = z.enum(["profile", "invite", "create", "publish", "validate"]);
export const coachOptionalStepKey = z.enum(["equipment", "video", "phase", "install"]);
export type CoachStepKeyValue = z.infer<typeof coachStepKey>;
export type CoachOptionalStepKeyValue = z.infer<typeof coachOptionalStepKey>;

// La clé d'un écran dont le repère a été vu : celle de l'aide par écran (`suivi`, `calendrierCoach`…).
export const onboardingScreenKey = z.string().regex(/^[a-zA-Z]{1,40}$/);

export const onboardingPatch = z
  .object({
    // Le tour de piste a été vu ou refermé.
    tourSeen: z.literal(true).optional(),
    // L'accueil de l'athlète a été refermé.
    welcomeSeen: z.literal(true).optional(),
    // `true` referme la carte des premiers pas (ou la carte facultative de l'athlète), `false` la rouvre.
    dismissed: z.boolean().optional(),
    // La fin des premiers pas a été fêtée.
    celebrated: z.literal(true).optional(),
    // Écarter une étape facultative, ou la reprendre.
    skip: coachOptionalStepKey.optional(),
    unskip: coachOptionalStepKey.optional(),
    // Le repère de première visite de cet écran a été vu.
    seenScreen: onboardingScreenKey.optional(),
  })
  .strict();
export type OnboardingPatch = z.infer<typeof onboardingPatch>;

const step = z.object({ key: coachStepKey, done: z.boolean() });
const optionalStep = z.object({ key: coachOptionalStepKey, done: z.boolean(), skipped: z.boolean() });

export const onboardingResponse = z.object({
  // `false` : membre arrivé avant ce suivi ; il n'est ni guidé ni accueilli.
  guided: z.boolean(),
  staff: z.boolean(),
  tourSeenAt: z.string().nullable(),
  welcomeSeenAt: z.string().nullable(),
  dismissedAt: z.string().nullable(),
  celebratedAt: z.string().nullable(),
  skipped: z.array(coachOptionalStepKey),
  seenScreens: z.array(z.string()),
  // Coach : les étapes, leur avancement, et ce que l'écran doit montrer. Vides pour un athlète.
  steps: z.array(step),
  optionalSteps: z.array(optionalStep),
  progress: z.object({ done: z.number().int(), total: z.number().int() }),
  guideVisible: z.boolean(),
  tourDue: z.boolean(),
  celebrationDue: z.boolean(),
  // Athlète : la carte facultative d'après la première validation.
  extrasVisible: z.boolean(),
});
export type OnboardingResponse = z.infer<typeof onboardingResponse>;

// Quelques invitations nominatives d'un coup, pour un groupe : création de l'espace et carte des premiers pas.
export const INVITE_EMAILS_MAX = 20;
export const inviteEmailsInput = z.object({
  groupId: uuid,
  emails: z.array(z.email("Adresse e-mail invalide")).min(1).max(INVITE_EMAILS_MAX),
});
export type InviteEmailsInput = z.infer<typeof inviteEmailsInput>;
