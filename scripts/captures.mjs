#!/usr/bin/env node
// Refait les captures du site et des stores depuis la base de démonstration locale.
//   pnpm captures [--dry-run] [--only=ios|web] [--build] [--store] [--android]
// --store : pleine définition sur iPhone 17 Pro Max, dans apps/mobile/store/ios, sans toucher au site.
// --android : 1080 × 1920 sur l'émulateur Android démarré, dans apps/mobile/store/android, sans toucher au site.
// Mode opératoire et prérequis : docs/exploitation/captures.md.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMAGES = path.join(ROOT, "apps/web/src/features/landing/images");
const PROVENANCE = path.join(IMAGES, "provenance.json");
const WEB_ENV = path.join(ROOT, "apps/web/.env");

const SCHEME = "tartan-dev";
const BUNDLE_ID = "coach.tartan.app.dev";
const COACH_EMAIL = "coach@capture.tartan.test";
const ATHLETE_EMAIL = "athlete@capture.tartan.test";
const DEVICE = "iPhone 17 Pro";
const MAX_SIDE = "1600";
// Apple n'accepte que 1260 × 2736, 1290 × 2796 ou 1320 × 2868 pour le grand format : aucune réduction.
const STORE_DEVICE = "iPhone 17 Pro Max";
const STORE_IMAGES = path.join(ROOT, "apps/mobile/store/ios");
const ANDROID_IMAGES = path.join(ROOT, "apps/mobile/store/android");
const ANDROID_SIZE = "1080x1920";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

const SESSIONS = {
  force: "Force bas du corps",
  plyo: "Pliométrie, contacts courts",
  technique: "Technique de course",
  plots: "Appuis sur plots",
};
const PLACEHOLDER = (name) => `<${name}>`;

const fail = (message) => {
  console.error(`captures : ${message}`);
  process.exit(1);
};

const parseArgs = (argv) => {
  const options = { dryRun: false, build: false, only: null, store: false, android: false };
  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--build") options.build = true;
    else if (arg === "--store") options.store = true;
    else if (arg === "--android") options.android = true;
    else if (arg === "--only=ios" || arg === "--only=web") options.only = arg.slice("--only=".length);
    else fail(`option inconnue : ${arg}. Usage : pnpm captures [--dry-run] [--only=ios|web] [--build] [--store] [--android]`);
  }
  return options;
};

const databaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!existsSync(WEB_ENV)) return null;
  const line = readFileSync(WEB_ENV, "utf8")
    .split("\n")
    .find((row) => row.startsWith("DATABASE_URL="));
  return line
    ? line
        .slice("DATABASE_URL=".length)
        .trim()
        .replace(/^["']|["']$/g, "")
    : null;
};

// Jamais le mot de passe dans un message : seul l'hôte y figure.
const assertLocalDatabase = (url) => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail("refuse une adresse de base illisible.");
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) fail("refuse une adresse qui n'est pas PostgreSQL.");
  if (!LOCAL_HOSTS.has(parsed.hostname)) fail(`refuse toute base qui n'est pas locale (hôte : ${parsed.hostname}).`);
  // psql laisse ces paramètres remplacer l'hôte de l'adresse.
  for (const key of parsed.searchParams.keys()) {
    if (["host", "hostaddr", "service"].includes(key.toLowerCase())) {
      fail(`refuse toute base qui n'est pas locale (paramètre ${key}).`);
    }
  }
};

const assertLocalWeb = (url) => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail("refuse une CAPTURE_BASE_URL illisible.");
  }
  if (!LOCAL_HOSTS.has(parsed.hostname)) fail(`refuse tout serveur qui n'est pas local (hôte : ${parsed.hostname}).`);
};

const psql = (url, sql) =>
  execFileSync("psql", [url, "-X", "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((row) => row.split("\t"));

const literal = (value) => `'${value.replaceAll("'", "''")}'`;

// Séances à venir : une séance passée porte déjà une validation et n'ouvre pas le même écran.
const readDemoIds = (url) => {
  const owned = `JOIN organizations o ON o.id = t.organization_id JOIN "user" u ON u.id = o.owner_id WHERE u.email = ${literal(COACH_EMAIL)}`;
  const titles = Object.values(SESSIONS).map(literal).join(", ");
  const sessions = psql(
    url,
    `SELECT DISTINCT ON (t.title) t.title, t.id FROM scheduled_sessions t ${owned} AND t.title IN (${titles}) AND t.published_at IS NOT NULL AND t.date >= current_date ORDER BY t.title, t.date ASC`,
  );
  const videos = psql(
    url,
    `SELECT t.id FROM videos t ${owned} AND t.status = 'ready' ORDER BY t.created_at DESC LIMIT 1`,
  );
  const byTitle = new Map(sessions);
  const ids = { video: videos[0]?.[0] ?? null };
  for (const [key, title] of Object.entries(SESSIONS)) ids[key] = byTitle.get(title) ?? null;
  return ids;
};

const missingIds = (ids) => Object.entries(ids).flatMap(([key, value]) => (value ? [] : [key]));

const iosScreens = (ids) => {
  const session = (key, index) => `${SCHEME}://session/${ids[key]}?i=${index}`;
  return [
    { file: "ios-accueil.png", url: `${SCHEME}://today` },
    { file: "ios-mois.png", url: `${SCHEME}://agenda` },
    { file: "ios-muscu.png", url: session("force", 1) },
    { file: "ios-plio.png", url: session("plyo", 1) },
    { file: "ios-technique.png", url: session("technique", 0) },
    { file: "ios-plots.png", url: session("plots", 0) },
    { file: "ios-video.png", url: `${SCHEME}://video/${ids.video}`, settleMs: 9000 },
    { file: "ios-progres.png", url: `${SCHEME}://progress` },
  ];
};

const readManifest = () => JSON.parse(readFileSync(PROVENANCE, "utf8"));

// Une capture ajoutée au manifeste sans étape ici doit arrêter le script, pas passer inaperçue.
const assertCoversManifest = (screens) => {
  const expected = readManifest()
    .captures.filter((capture) => capture.source === "ios")
    .map((capture) => capture.file)
    .sort();
  const planned = screens.map((screen) => screen.file).sort();
  if (expected.join() !== planned.join()) {
    fail(`provenance.json et le script divergent : ${expected.join(", ")} / ${planned.join(", ")}.`);
  }
};

// Même mise en forme que le fichier versionné : une capture par ligne.
const renderManifest = ({ captures, ...head }) => {
  const body = JSON.stringify(head, null, 2).slice(0, -2);
  const rows = captures.map(
    (capture) =>
      `    { ${Object.entries(capture)
        .map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`)
        .join(", ")} }`,
  );
  return `${body},\n  "captures": [\n${rows.join(",\n")}\n  ]\n}\n`;
};

const makeRunner = (dryRun) => {
  const show = (command, args, env) =>
    [...Object.entries(env ?? {}).map(([key, value]) => `${key}=${value}`), command, ...args].join(" ");
  return {
    run: (command, args, env) => {
      if (dryRun) {
        console.log(`[à sec] ${show(command, args, env)}`);
        return "";
      }
      console.log(`> ${show(command, args, env)}`);
      return execFileSync(command, args, {
        cwd: ROOT,
        encoding: "utf8",
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "inherit"],
      });
    },
    wait: (ms) => (dryRun ? undefined : sleep(ms)),
  };
};

const bootedDevice = () => {
  const { devices } = JSON.parse(
    execFileSync("xcrun", ["simctl", "list", "devices", "booted", "-j"], { encoding: "utf8" }),
  );
  for (const [runtime, list] of Object.entries(devices)) {
    const device = list.find((entry) => entry.state === "Booted");
    if (device) {
      const version = /iOS-(\d+)-(\d+)/.exec(runtime);
      return { name: device.name, ios: version ? `${version[1]}.${version[2]}` : "inconnue" };
    }
  }
  return null;
};

const captureIos = async ({ dryRun, build, store }, runner, screens) => {
  const deviceName = store ? STORE_DEVICE : DEVICE;
  const target = store ? STORE_IMAGES : IMAGES;
  if (build) {
    runner.run(
      "corepack",
      [
        "pnpm",
        "--filter",
        "@tartan/mobile",
        "exec",
        "expo",
        "run:ios",
        "--configuration",
        "Release",
        "--device",
        deviceName,
        "--no-bundler",
      ],
      {
        EXPO_PUBLIC_API_URL: "http://localhost:3000",
        EXPO_PUBLIC_WEB_URL: "http://localhost:3000",
        SENTRY_DISABLE_AUTO_UPLOAD: "true",
      },
    );
  }
  let device = { name: deviceName, ios: "à lire sur le simulateur" };
  if (!dryRun) {
    device = bootedDevice();
    if (!device) fail(`aucun simulateur démarré. Lance « ${deviceName} », ou ajoute --build.`);
    if (store && device.name !== STORE_DEVICE) fail(`les captures des stores exigent « ${STORE_DEVICE} ».`);
    try {
      execFileSync("xcrun", ["simctl", "get_app_container", "booted", BUNDLE_ID], { stdio: "ignore" });
    } catch {
      fail(`${BUNDLE_ID} n'est pas installée sur le simulateur démarré. Ajoute --build.`);
    }
  }
  console.log(`Session attendue sur le simulateur : ${ATHLETE_EMAIL}.`);
  const dir = dryRun ? path.join(tmpdir(), "captures-a-sec") : mkdtempSync(path.join(tmpdir(), "tartan-captures-"));
  const home = screens[0].url;
  runner.run("xcrun", [
    "simctl",
    "status_bar",
    "booted",
    "override",
    "--time",
    "9:41",
    "--batteryState",
    "charged",
    "--batteryLevel",
    "100",
  ]);
  try {
    for (const screen of screens) {
      // Repasser par l'accueil : deux liens de séance à la suite réutiliseraient le même écran, sur le mauvais exercice.
      if (screen.url !== home) {
        runner.run("xcrun", ["simctl", "openurl", "booted", home]);
        await runner.wait(1500);
      }
      runner.run("xcrun", ["simctl", "openurl", "booted", screen.url]);
      await runner.wait(screen.settleMs ?? 4000);
      const raw = path.join(dir, `brut-${screen.file}`);
      runner.run("xcrun", ["simctl", "io", "booted", "screenshot", raw]);
      if (store) runner.run("cp", [raw, path.join(dir, screen.file)]);
      else runner.run("sips", ["-Z", MAX_SIDE, raw, "--out", path.join(dir, screen.file)]);
    }
  } finally {
    runner.run("xcrun", ["simctl", "status_bar", "booted", "clear"]);
  }
  // Copie à la fin seulement : un écran raté ne laisse pas un jeu d'images à moitié remplacé.
  for (const screen of screens) {
    const from = path.join(dir, screen.file);
    const to = path.join(target, screen.file);
    if (dryRun) console.log(`[à sec] copie ${from} vers ${path.relative(ROOT, to)}`);
    else {
      mkdirSync(target, { recursive: true });
      copyFileSync(from, to);
    }
  }
  if (!dryRun) rmSync(dir, { recursive: true, force: true });
  return device;
};

const adbPath = () => {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? path.join(process.env.HOME ?? "", "Library/Android/sdk");
  return path.join(sdk, "platform-tools/adb");
};

// Mêmes écrans que sur iOS, nommés pour Android. La barre d'état passe en mode démo : 9:41, batterie pleine.
const captureAndroid = async ({ dryRun }, runner, screens) => {
  const adb = adbPath();
  if (!dryRun) {
    const devices = execFileSync(adb, ["devices"], { encoding: "utf8" });
    if (!/emulator-\d+\s+device/.test(devices)) fail("aucun émulateur Android démarré (adb devices).");
    const size = execFileSync(adb, ["shell", "wm", "size"], { encoding: "utf8" });
    if (!size.includes(ANDROID_SIZE)) fail(`l'émulateur doit mesurer ${ANDROID_SIZE} (wm size : ${size.trim()}).`);
    const packages = execFileSync(adb, ["shell", "pm", "list", "packages", BUNDLE_ID], { encoding: "utf8" });
    if (!packages.includes(BUNDLE_ID)) fail(`${BUNDLE_ID} n'est pas installée sur l'émulateur.`);
  }
  console.log(`Session attendue sur l'émulateur : ${ATHLETE_EMAIL}.`);
  // L'émulateur joint le serveur local du Mac par la même adresse que le simulateur iOS.
  runner.run(adb, ["reverse", "tcp:3000", "tcp:3000"]);
  const demo = (command, extras = []) =>
    runner.run(adb, ["shell", "am", "broadcast", "-a", "com.android.systemui.demo", "-e", "command", command, ...extras]);
  runner.run(adb, ["shell", "settings", "put", "global", "sysui_demo_allowed", "1"]);
  demo("enter");
  demo("clock", ["-e", "hhmm", "0941"]);
  demo("battery", ["-e", "level", "100", "-e", "plugged", "false"]);
  demo("network", ["-e", "mobile", "hide"]);
  demo("network", ["-e", "wifi", "show", "-e", "level", "4", "-e", "fully", "true"]);
  demo("notifications", ["-e", "visible", "false"]);
  const dir = dryRun ? path.join(tmpdir(), "captures-a-sec") : mkdtempSync(path.join(tmpdir(), "tartan-captures-"));
  const files = screens.map((screen) => ({ ...screen, file: screen.file.replace(/^ios-/, "android-") }));
  const home = files[0].url;
  const open = (url) => runner.run(adb, ["shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", url, BUNDLE_ID]);
  try {
    for (const screen of files) {
      if (screen.url !== home) {
        open(home);
        await runner.wait(1500);
      }
      open(screen.url);
      await runner.wait(screen.settleMs ?? 4000);
      runner.run(adb, ["shell", "screencap", "-p", "/sdcard/tartan-capture.png"]);
      runner.run(adb, ["pull", "/sdcard/tartan-capture.png", path.join(dir, screen.file)]);
    }
  } finally {
    runner.run(adb, ["shell", "rm", "-f", "/sdcard/tartan-capture.png"]);
    demo("exit");
  }
  for (const screen of files) {
    const from = path.join(dir, screen.file);
    const to = path.join(ANDROID_IMAGES, screen.file);
    if (dryRun) console.log(`[à sec] copie ${from} vers ${path.relative(ROOT, to)}`);
    else {
      mkdirSync(ANDROID_IMAGES, { recursive: true });
      copyFileSync(from, to);
    }
  }
  if (!dryRun) rmSync(dir, { recursive: true, force: true });
};

const captureWeb = async ({ dryRun }, runner, baseUrl) => {
  if (!dryRun) {
    const ok = await fetch(`${baseUrl}/connexion`, { signal: AbortSignal.timeout(10_000) })
      .then((res) => res.ok)
      .catch(() => false);
    if (!ok) fail(`aucun serveur web sur ${baseUrl}. Lance pnpm dev sur la base de démonstration.`);
  }
  runner.run(
    "corepack",
    ["pnpm", "--filter", "@tartan/web", "exec", "playwright", "test", "e2e/captures.spec.ts", "--project=desktop"],
    { CAPTURE_BASE_URL: baseUrl },
  );
};

const updateManifest = ({ dryRun }, runner, device) => {
  const manifest = readManifest();
  const commit = dryRun ? "<commit>" : runner.run("git", ["rev-parse", "--short", "HEAD"]).trim();
  const capturedAt = new Date().toISOString().slice(0, 10);
  const { dataset, device: previous, clip, captures } = manifest;
  const next = {
    dataset,
    device: device
      ? `${device.name}, iOS ${device.ios}, simulateur, build Release de la branche ; barre d'état normalisée`
      : previous,
    capturedAt,
    commit,
    clip,
    captures,
  };
  if (dryRun) console.log(`[à sec] provenance.json : ${JSON.stringify({ device: next.device, capturedAt, commit })}`);
  else writeFileSync(PROVENANCE, renderManifest(next));
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const url = databaseUrl();
  if (url) assertLocalDatabase(url);
  const baseUrl = (process.env.CAPTURE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  assertLocalWeb(baseUrl);
  const runner = makeRunner(options.dryRun);
  const wantsIos = options.only !== "web";
  const wantsWeb = options.only !== "ios" && !options.store && !options.android;

  let screens = [];
  if (wantsIos) {
    if (!url) fail("DATABASE_URL absente : ni dans l'environnement, ni dans apps/web/.env.");
    let ids;
    try {
      ids = readDemoIds(url);
    } catch (error) {
      if (!options.dryRun) fail(`base de démonstration illisible : ${String(error.stderr ?? error.message).trim()}`);
      console.warn(
        `[à sec] base de démonstration illisible, identifiants fictifs : ${String(error.stderr ?? error.message).trim()}`,
      );
      ids = { video: null, force: null, plyo: null, technique: null, plots: null };
    }
    const missing = missingIds(ids);
    if (missing.length > 0) {
      const hint = `identifiants absents (${missing.join(", ")}) : lance pnpm --filter @tartan/web demo:preparation.`;
      if (!options.dryRun) fail(hint);
      console.warn(`[à sec] ${hint}`);
      for (const key of missing) ids[key] = PLACEHOLDER(key);
    }
    screens = iosScreens(ids);
    assertCoversManifest(screens);
  }

  if (options.android) {
    await captureAndroid(options, runner, screens);
    console.log(options.dryRun ? "Fin de la simulation : rien n'a été écrit." : "Captures Android écrites.");
    return;
  }
  const device = wantsIos ? await captureIos(options, runner, screens) : null;
  if (wantsWeb) await captureWeb(options, runner, baseUrl);
  // Le manifeste décrit les images du site, pas celles des stores.
  if (!options.store) updateManifest(options, runner, device);
  console.log(options.dryRun ? "Fin de la simulation : rien n'a été écrit." : options.store ? "Captures des stores écrites." : "Captures écrites et provenance à jour.");
};

await main();
