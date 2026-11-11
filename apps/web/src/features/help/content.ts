import { m } from "@tartan/i18n";

const themes = m.help.themes;

export type HelpThemeId = keyof typeof themes;
type LinkKey = keyof typeof m.help.links;

type QuestionSpec = {
  id: string;
  // Parle d'offre ou d'installation depuis le navigateur : absente des pages ouvertes par l'app native.
  siteOnly?: boolean;
  link?: { href: string; label: LinkKey; embeddedHref?: string };
};

type ThemeSpec = { id: HelpThemeId; siteOnly?: boolean; questions: QuestionSpec[] };

// L'ordre des couloirs et des questions. Les textes vivent dans `packages/i18n`.
export const HELP_OUTLINE: ThemeSpec[] = [
  {
    id: "demarrer",
    questions: [{ id: "pourQui" }, { id: "creerEspace" }, { id: "premiersPas" }, { id: "telephone", siteOnly: true }],
  },
  {
    id: "groupe",
    questions: [{ id: "inviter" }, { id: "invitationPerdue" }, { id: "inviterCoach" }, { id: "depart" }],
  },
  {
    id: "seances",
    questions: [{ id: "publier" }, { id: "programmer" }, { id: "autonomie" }, { id: "charges" }, { id: "suivi" }],
  },
  {
    id: "athlete",
    questions: [
      { id: "rejoindre" },
      { id: "valider" },
      { id: "installer", siteOnly: true },
      { id: "notifications", siteOnly: true },
      { id: "horsLigne" },
    ],
  },
  {
    id: "videos",
    questions: [{ id: "quiVoit" }, { id: "commenter" }, { id: "conservation", siteOnly: true }, { id: "lecture" }],
  },
  {
    id: "compte",
    questions: [
      { id: "emailConnexion" },
      { id: "changerEmail" },
      { id: "naissance" },
      { id: "moinsEmails" },
      { id: "supprimer", link: { href: "/suppression-compte", label: "deleteAccount", embeddedHref: "" } },
    ],
  },
  {
    id: "abonnement",
    siteOnly: true,
    questions: [
      { id: "quiPaie" },
      { id: "limites", link: { href: "/tarifs", label: "pricing" } },
      { id: "factures" },
      { id: "paiementEchoue" },
      { id: "resilier" },
      { id: "remboursement", link: { href: "/cgv", label: "sales" } },
    ],
  },
  {
    id: "donnees",
    questions: [
      { id: "devenir", link: { href: "/confidentialite", label: "privacy", embeddedHref: "/mobile/confidentialite" } },
      { id: "sante" },
      { id: "exporter" },
      { id: "signaler" },
    ],
  },
];

// Les questions qu'un visiteur se pose avant de s'inscrire, reprises telles quelles sur la page d'accueil.
export const LANDING_QUESTIONS: Array<[HelpThemeId, string]> = [
  ["demarrer", "pourQui"],
  ["demarrer", "telephone"],
  ["seances", "charges"],
  ["athlete", "horsLigne"],
  ["abonnement", "quiPaie"],
  ["donnees", "devenir"],
];

export type HelpQuestion = { id: string; q: string; a: string; link: { href: string; label: string } | null };
export type HelpTheme = { id: HelpThemeId; title: string; questions: HelpQuestion[] };

// Depuis l'app native, rien ne mène à une offre ni à un prix.
export const helpThemes = (embedded = false): HelpTheme[] =>
  HELP_OUTLINE.filter((theme) => !(embedded && theme.siteOnly)).map((theme) => {
    const texts = themes[theme.id].questions as Record<string, { q: string; a: string }>;
    return {
      id: theme.id,
      title: themes[theme.id].title,
      questions: theme.questions
        .filter((question) => !(embedded && question.siteOnly))
        .map((question) => {
          const href = embedded ? question.link?.embeddedHref : question.link?.href;
          return {
            id: question.id,
            ...texts[question.id]!,
            link: question.link && href ? { href, label: m.help.links[question.link.label] } : null,
          };
        }),
    };
  });

export const landingQuestions = (): HelpQuestion[] => {
  const all = helpThemes();
  return LANDING_QUESTIONS.map(([theme, id]) => {
    const question = all.find((item) => item.id === theme)?.questions.find((item) => item.id === id);
    if (!question) throw new Error(`Question d'aide introuvable : ${theme}.${id}`);
    return question;
  });
};
