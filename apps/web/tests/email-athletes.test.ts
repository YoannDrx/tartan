import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@react-email/render";
import { createElement } from "react";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MagicLinkEmail, WelcomeEmail } from "@email/auth";
import { EMAIL_ATHLETE_HEIGHT, EMAIL_ATHLETES, emailAthletePath, type EmailAthlete } from "@email/athletes";

const file = (name: EmailAthlete) => path.resolve(import.meta.dirname, "../public", `.${emailAthletePath(name)}`);

describe("athlètes des e-mails", () => {
  it("chaque athlète déclaré a son image, tirée au double de sa hauteur affichée", async () => {
    for (const name of Object.keys(EMAIL_ATHLETES) as EmailAthlete[]) {
      expect(existsSync(file(name)), name).toBe(true);
      const { height, format } = await sharp(readFileSync(file(name))).metadata();
      expect({ name, format, height }).toEqual({ name, format: "png", height: EMAIL_ATHLETE_HEIGHT * 2 });
    }
  });

  it("l'athlète se tient dans le bandeau d'une bonne nouvelle, jamais dans un e-mail de sécurité", async () => {
    const welcome = await render(createElement(WelcomeEmail, { space: "Sprint", url: "https://tartan.coach/suivi" }));
    expect(welcome).toContain(`https://tartan.coach${emailAthletePath("welcome")}`);
    const magic = await render(createElement(MagicLinkEmail, { url: "https://app.tartan.coach/lien" }));
    expect(magic).not.toContain("/brand/email/");
  });
});
