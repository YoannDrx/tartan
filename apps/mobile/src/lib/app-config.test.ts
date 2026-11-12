import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Les machines de build EAS lisent app.config.ts sans le support natif du TypeScript de Node : un fichier .ts
// importé par la configuration y cassait l'étape « Read app config ». On rejoue la lecture dans ces conditions.
const MOBILE = path.join(import.meta.dirname, "..", "..");

const readConfig = (variant: string, nodeOptions: string) =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [path.join(MOBILE, "node_modules/expo/bin/cli"), "config", "--json", "--full", "--type", "public"],
      {
        cwd: MOBILE,
        env: {
          ...process.env,
          NODE_OPTIONS: nodeOptions,
          APP_VARIANT: variant,
          EXPO_PUBLIC_API_URL: "https://app.tartan.coach",
          EXPO_PUBLIC_WEB_URL: "https://tartan.coach",
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    ),
  ) as { exp: { name: string; ios: { infoPlist: Record<string, string> } } };

describe("configuration Expo", () => {
  it.each(["", "--no-experimental-strip-types --no-experimental-require-module"])(
    "se lit en production, avec les textes du paquet i18n (options Node : %s)",
    (nodeOptions) => {
      const { exp } = readConfig("production", nodeOptions);
      expect(exp.name).toBe("Tartan");
      expect(exp.ios.infoPlist.NSMicrophoneUsageDescription).toMatch(/micro/);
    },
    60_000,
  );
});
