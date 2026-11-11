import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Garde de déterminisme. La simulation doit donner le même score sur tous les moteurs JavaScript :
// elle ne manie que des entiers, sans horloge, sans hasard hors graine, sans fonction dont le
// résultat dépend du moteur. Ce test lit les sources du paquet et échoue dès qu'une écriture
// interdite y apparaît.

const SRC = fileURLToPath(new URL(".", import.meta.url));

// Seul fichier où la division est permise : elle y est ramenée à l'entier.
const DIVISION_ALLOWED = "core/int.ts";

// Les seules fonctions de Math dont le résultat est exact sur des entiers.
const MATH_ALLOWED = new Set(["imul", "trunc", "abs", "min", "max"]);

const FORBIDDEN_NAMES = [
  "Date",
  "performance",
  "Intl",
  "crypto",
  "setTimeout",
  "setInterval",
  "requestAnimationFrame",
  "queueMicrotask",
  "parseFloat",
  "toFixed",
  "toPrecision",
  "toLocaleString",
  "Float32Array",
  "Float64Array",
  "localeCompare",
  "process",
  "window",
  "document",
  "navigator",
];

// Efface commentaires et chaînes, en gardant les sauts de ligne pour que les numéros de ligne restent justes.
function stripCommentsAndStrings(source: string): string {
  let out = "";
  let index = 0;
  const blank = (text: string) => text.replace(/[^\n]/g, " ");
  while (index < source.length) {
    const two = source.slice(index, index + 2);
    const char = source[index] ?? "";
    if (two === "//") {
      const end = source.indexOf("\n", index);
      const stop = end === -1 ? source.length : end;
      out += blank(source.slice(index, stop));
      index = stop;
    } else if (two === "/*") {
      const end = source.indexOf("*/", index + 2);
      const stop = end === -1 ? source.length : end + 2;
      out += blank(source.slice(index, stop));
      index = stop;
    } else if (char === '"' || char === "'" || char === "`") {
      let stop = index + 1;
      while (stop < source.length && source[stop] !== char) stop += source[stop] === "\\" ? 2 : 1;
      out += char + blank(source.slice(index + 1, stop)) + char;
      index = stop + 1;
    } else {
      out += char;
      index += 1;
    }
  }
  return out;
}

function findViolations(file: string, source: string): string[] {
  const violations: string[] = [];
  const lines = stripCommentsAndStrings(source).split("\n");
  lines.forEach((line, lineIndex) => {
    const report = (reason: string) => violations.push(`${file}:${lineIndex + 1} ${reason}`);
    for (const match of line.matchAll(/\bMath\s*\.\s*(\w+)/g)) {
      if (!MATH_ALLOWED.has(match[1] ?? "")) report(`Math.${match[1]} interdit`);
    }
    if (/\bMath\s*\[/.test(line)) report("accès indirect à Math interdit");
    for (const name of FORBIDDEN_NAMES) {
      if (new RegExp(`\\b${name}\\b`).test(line)) report(`${name} interdit`);
    }
    if (line.includes("**")) report("puissance interdite");
    if (/\d\.\d|\d[eE][+-]?\d|(^|[^\w.])\.\d/.test(line.replace(/0x[\da-fA-F_]+/g, "0"))) {
      report("nombre à virgule interdit");
    }
    if (file !== DIVISION_ALLOWED && line.includes("/")) report("division hors de core/int.ts");
  });
  return violations;
}

const sources = readdirSync(SRC, { recursive: true, encoding: "utf8" })
  .filter((path) => path.endsWith(".ts") && !path.endsWith(".test.ts"))
  .map((path) => relative(SRC, join(SRC, path)).split(sep).join("/"))
  .sort();

describe("garde de déterminisme", () => {
  it("couvre le noyau, les épreuves et les parties de référence", () => {
    expect(sources).toEqual(
      expect.arrayContaining([
        "core/int.ts",
        "core/replay.ts",
        "core/rng.ts",
        "core/sim.ts",
        "events/hurdles.ts",
        "reference/fuzz.ts",
      ]),
    );
  });

  it.each(sources)("%s ne contient aucune écriture interdite", (file) => {
    expect(findViolations(file, readFileSync(join(SRC, file), "utf8"))).toEqual([]);
  });

  it.each([
    ["Math.sin(angle)", "Math.sin interdit"],
    ["Math.cos(angle)", "Math.cos interdit"],
    ["Math.exp(x)", "Math.exp interdit"],
    ["Math.pow(x, 2)", "Math.pow interdit"],
    ["Math.sqrt(x)", "Math.sqrt interdit"],
    ["Math.random()", "Math.random interdit"],
    ["Math.floor(x)", "Math.floor interdit"],
    ["Math . round(x)", "Math.round interdit"],
    ['Math["sin"](x)', "accès indirect à Math interdit"],
    ["const now = Date.now();", "Date interdit"],
    ["const t = performance.now();", "performance interdit"],
    ["const square = x ** 2;", "puissance interdite"],
    ["const half = x * 0.5;", "nombre à virgule interdit"],
    ["const tiny = 1e-3;", "nombre à virgule interdit"],
    ["const half = x * .5;", "nombre à virgule interdit"],
    ["const ratio = a / b;", "division hors de core/int.ts"],
  ])("repère %s", (line, reason) => {
    expect(findViolations("events/example.ts", `const before = 1;\n${line}\n`)).toEqual([
      `events/example.ts:2 ${reason}`,
    ]);
  });

  it("laisse passer l'arithmétique entière, les commentaires et les chaînes", () => {
    const source = [
      "// 1/120 s, 0,1 mm/s, Math.sin dans un commentaire",
      "/* Date.now() / 2 ** 0.5 */",
      'const label = "Math.random() / 2.5";',
      "const a = Math.imul(x, 0x7fff_ffff) | 0;",
      "const b = Math.trunc(a) + Math.max(a, 1_000) - (a >> 1) + (a % 7);",
      "const { x: first, y: second } = point;",
    ].join("\n");
    expect(findViolations("events/example.ts", source)).toEqual([]);
    expect(findViolations("core/int.ts", "export const idiv = (a, b) => (a / b) | 0;")).toEqual([]);
  });
});
