import { describe, expect, it } from "vitest";
import { staysInPlayer } from "./webview-guard";

const initial = "https://www.instagram.com/p/abc/embed/";

describe("lecteur vidéo restreint", () => {
  it("charge la page du lecteur et ses cadres internes", () => {
    expect(staysInPlayer({ url: initial, isTopFrame: true }, initial)).toBe(true);
    expect(staysInPlayer({ url: "about:blank", isTopFrame: true }, initial)).toBe(true);
    expect(staysInPlayer({ url: "https://www.youtube-nocookie.com/embed/x", isTopFrame: false }, null)).toBe(true);
  });
  it("refuse d'aller ailleurs dans le lecteur", () => {
    expect(staysInPlayer({ url: "https://www.instagram.com/explore/", isTopFrame: true }, initial)).toBe(false);
    expect(staysInPlayer({ url: "https://www.youtube.com/watch?v=x", isTopFrame: true }, "https://tartan.coach")).toBe(
      false,
    );
  });
  it("refuse tout ce qui n'est pas chiffré dans un cadre", () => {
    expect(staysInPlayer({ url: "http://exemple.test/", isTopFrame: false }, initial)).toBe(false);
  });
});
