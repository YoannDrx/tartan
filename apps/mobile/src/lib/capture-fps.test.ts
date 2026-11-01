import { describe, expect, it } from "vitest";
import { chooseCaptureFps } from "./capture-fps";

const device =
  (...rates: number[]) =>
  (fps: number) =>
    rates.includes(fps);

describe("chooseCaptureFps", () => {
  it("préfère 240, puis 120", () => {
    expect(chooseCaptureFps(device(30, 60, 120, 240))).toEqual({ fps: 240, slowMotion: true });
    expect(chooseCaptureFps(device(30, 60, 120))).toEqual({ fps: 120, slowMotion: true });
  });

  it("retombe sur le standard et le signale", () => {
    expect(chooseCaptureFps(device(30, 60))).toEqual({ fps: 60, slowMotion: false });
    expect(chooseCaptureFps(device(30))).toEqual({ fps: 30, slowMotion: false });
    expect(chooseCaptureFps(device())).toEqual({ fps: 30, slowMotion: false });
  });
});
