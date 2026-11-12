import { describe, expect, it } from "vitest";
import { playbackSource, shouldFallBackToHls } from "./playback-source";

const both = { mp4Url: "https://stream.mux.test/v.mp4", hlsUrl: "https://stream.mux.test/v.m3u8" };

describe("source de lecture d'une vidéo", () => {
  it("préfère le MP4, et prend le HLS quand le MP4 n'existe pas encore", () => {
    expect(playbackSource(both, false)).toBe(both.mp4Url);
    expect(playbackSource({ mp4Url: null, hlsUrl: both.hlsUrl }, false)).toBe(both.hlsUrl);
    expect(playbackSource({}, false)).toBeNull();
  });

  it("repart sur le HLS après un échec du MP4, une seule fois", () => {
    expect(shouldFallBackToHls(both, false)).toBe(true);
    expect(playbackSource(both, true)).toBe(both.hlsUrl);
    expect(shouldFallBackToHls(both, true)).toBe(false);
  });

  it("sans autre adresse, l'échec reste affiché avec son bouton pour réessayer", () => {
    expect(shouldFallBackToHls({ mp4Url: both.mp4Url, hlsUrl: null }, false)).toBe(false);
    expect(shouldFallBackToHls({ mp4Url: null, hlsUrl: both.hlsUrl }, false)).toBe(false);
  });
});
