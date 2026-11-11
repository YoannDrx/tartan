// Garde-fous de DESIGN.md : ce que la relecture oublie, le lint le refuse.
// Les textes vont dans packages/i18n, les couleurs dans packages/design-tokens.

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/;
const COLOR_FUNCTION = /(?<![a-zA-Z])(?:rgba?|hsla?|oklch|oklab)\(/;

const PALETTE = [
  "black",
  "white",
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
].join("|");
const UTILITY = [
  "bg",
  "text",
  "border",
  "ring",
  "fill",
  "stroke",
  "outline",
  "divide",
  "shadow",
  "from",
  "via",
  "to",
  "decoration",
  "caret",
  "placeholder",
].join("|");
const DEFAULT_PALETTE = new RegExp(`(?:^|[\\s:])(?:${UTILITY})-(?:${PALETTE})(?:-\\d{2,3})?(?:/\\d+)?(?=$|\\s)`);

// Durée, délai ou courbe écrits à la main dans une classe : `duration-200`, `delay-[80ms]`, `ease-out`.
// Les jetons passent par `duration-(--duration-enter)`, `delay-(--duration-instant)` et `ease-reception`.
const RAW_MOTION = new RegExp(
  "(?:^|[\\s:])(?:(?:duration|delay)-(?:\\d|\\[)|ease-(?:in-out|in|out|linear|\\[)|animate-(?:spin|ping|pulse|bounce|\\[))",
);
const RAW_CURVE = /cubic-bezier\(|steps\(/;

const TEXT_ATTRIBUTES = new Set(["title", "aria-label", "alt", "placeholder", "label", "lead"]);
const HAS_LETTER = /\p{L}/u;

// Chaque morceau de texte d'un nœud : une chaîne, ou les parties fixes d'un gabarit.
const chunksOf = (node) => {
  if (node.type === "Literal") return typeof node.value === "string" ? [node.value] : [];
  if (node.type === "TemplateLiteral") return node.quasis.map((quasi) => quasi.value.cooked ?? "");
  return [];
};

const isModuleSpecifier = (node) =>
  ["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration", "ImportExpression"].includes(
    node.parent?.type,
  );

const stringVisitor = (context, test, messageId) => {
  const check = (node) => {
    if (isModuleSpecifier(node)) return;
    if (chunksOf(node).some(test)) context.report({ node, messageId });
  };
  return { Literal: check, TemplateLiteral: check };
};

/** @type {import("eslint").Rule.RuleModule} */
const noRawColor = {
  meta: {
    type: "problem",
    docs: { description: "Aucune couleur écrite en dur : elle vient de packages/design-tokens." },
    messages: { raw: "Couleur en dur. Utilise un jeton de packages/design-tokens ou une variable du thème." },
    schema: [],
  },
  create: (context) => stringVisitor(context, (text) => HEX.test(text) || COLOR_FUNCTION.test(text), "raw"),
};

/** @type {import("eslint").Rule.RuleModule} */
const noDefaultPalette = {
  meta: {
    type: "problem",
    docs: { description: "Aucune classe de la palette Tailwind par défaut : seulement les rôles du thème." },
    messages: {
      palette: "Classe de palette par défaut. Utilise un rôle du thème (text-fg, bg-card, bg-ink…).",
    },
    schema: [],
  },
  create: (context) => stringVisitor(context, (text) => DEFAULT_PALETTE.test(text), "palette"),
};

/** @type {import("eslint").Rule.RuleModule} */
const noRawMotion = {
  meta: {
    type: "problem",
    docs: { description: "Aucune durée ni courbe écrite en dur : elles viennent de packages/design-tokens." },
    messages: {
      motion:
        "Durée ou courbe en dur. Utilise un jeton de mouvement : duration-(--duration-enter), ease-reception, motion.duration.*.",
    },
    schema: [],
  },
  create: (context) => stringVisitor(context, (text) => RAW_MOTION.test(text) || RAW_CURVE.test(text), "motion"),
};

// Les valeurs texte possibles d'une expression JSX : "a", `a`, cond ? "a" : "b", x && "a".
const literalBranches = (node) => {
  if (!node) return [];
  if (node.type === "Literal" || node.type === "TemplateLiteral") return [node];
  if (node.type === "ConditionalExpression")
    return [...literalBranches(node.consequent), ...literalBranches(node.alternate)];
  if (node.type === "LogicalExpression") return [...literalBranches(node.left), ...literalBranches(node.right)];
  return [];
};

/** @type {import("eslint").Rule.RuleModule} */
const noHardcodedText = {
  meta: {
    type: "problem",
    docs: { description: "Aucun texte affiché écrit en dur : il vient de packages/i18n." },
    messages: { text: "Texte en dur. Place-le dans packages/i18n et lis-le par m.*." },
    schema: [],
  },
  create: (context) => {
    const report = (node) => context.report({ node, messageId: "text" });
    const hasText = (node) => chunksOf(node).some((chunk) => HAS_LETTER.test(chunk));
    return {
      JSXText: (node) => {
        if (HAS_LETTER.test(node.value)) report(node);
      },
      JSXExpressionContainer: (node) => {
        const parent = node.parent?.type;
        if (parent !== "JSXElement" && parent !== "JSXFragment") return;
        for (const branch of literalBranches(node.expression)) if (hasText(branch)) report(branch);
      },
      JSXAttribute: (node) => {
        const name = node.name.type === "JSXIdentifier" ? node.name.name : "";
        if (!TEXT_ATTRIBUTES.has(name) || !node.value) return;
        const value = node.value.type === "JSXExpressionContainer" ? node.value.expression : node.value;
        for (const branch of literalBranches(value)) if (hasText(branch)) report(branch);
      },
    };
  },
};

const plugin = {
  meta: { name: "tartan" },
  rules: {
    "no-raw-color": noRawColor,
    "no-default-palette": noDefaultPalette,
    "no-hardcoded-text": noHardcodedText,
    "no-raw-motion": noRawMotion,
  },
};

export default plugin;
