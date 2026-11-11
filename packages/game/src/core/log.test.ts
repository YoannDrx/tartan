import { describe, expect, it } from "vitest";
import { MAX_TICKS } from "./constants";
import { MAX_ENTRY, decodeLog, encodeEntry, encodeLog, entryChannel, entryDelta, entryPress } from "./log";

describe("journal des appuis", () => {
  it("range le pas, le canal et l'appui dans un seul entier", () => {
    const entry = encodeEntry(37, 1, true);
    expect(entry).toBe((37 << 2) | (1 << 1) | 1);
    expect(entryDelta(entry)).toBe(37);
    expect(entryChannel(entry)).toBe(1);
    expect(entryPress(entry)).toBe(true);
  });

  it("fait l'aller-retour entre changements datés et journal", () => {
    const transitions = [
      { tick: 0, channel: 0, press: true },
      { tick: 0, channel: 1, press: true },
      { tick: 12, channel: 0, press: false },
      { tick: 500, channel: 1, press: false },
    ];
    const log = encodeLog(transitions);
    expect(log).toEqual([1, 3, 48, 1954]);
    expect(decodeLog(log)).toEqual(transitions);
  });

  it("borne une entrée à la durée d'une partie", () => {
    expect(MAX_ENTRY).toBe(((MAX_TICKS - 1) << 2) | 3);
    expect(encodeLog([{ tick: MAX_TICKS - 1, channel: 1, press: true }])).toEqual([MAX_ENTRY]);
  });

  it("refuse un changement hors bornes ou daté avant le précédent", () => {
    expect(() => encodeLog([{ tick: MAX_TICKS, channel: 0, press: true }])).toThrow(RangeError);
    expect(() => encodeLog([{ tick: 3, channel: 2, press: true }])).toThrow(RangeError);
    expect(() =>
      encodeLog([
        { tick: 10, channel: 0, press: true },
        { tick: 9, channel: 0, press: false },
      ]),
    ).toThrow(RangeError);
  });
});
