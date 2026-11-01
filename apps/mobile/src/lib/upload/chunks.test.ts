import { describe, expect, it } from "vitest";
import {
  CHUNK_SIZE,
  classifyResponse,
  contentRange,
  nextChunk,
  offsetFromRangeHeader,
  progressPct,
  retryDelayMs,
  statusProbeRange,
} from "./chunks";

describe("nextChunk", () => {
  it("découpe en morceaux multiples de 256 Kio", () => {
    expect(CHUNK_SIZE % (256 * 1024)).toBe(0);
    expect(nextChunk(0, CHUNK_SIZE * 2)).toEqual({ start: 0, end: CHUNK_SIZE - 1, length: CHUNK_SIZE });
  });

  it("raccourcit le dernier morceau", () => {
    expect(nextChunk(10, 15, 10)).toEqual({ start: 10, end: 14, length: 5 });
  });

  it("s'arrête à la fin du fichier", () => {
    expect(nextChunk(15, 15, 10)).toBeNull();
  });
});

describe("en-têtes", () => {
  it("écrit Content-Range", () => {
    expect(contentRange({ start: 0, end: 9, length: 10 }, 100)).toBe("bytes 0-9/100");
    expect(statusProbeRange(100)).toBe("bytes */100");
  });

  it("reprend à l'octet suivant", () => {
    expect(offsetFromRangeHeader("bytes=0-4194303")).toBe(4194304);
    expect(offsetFromRangeHeader("0-9")).toBe(10);
  });

  it("repart de zéro sans en-tête", () => {
    expect(offsetFromRangeHeader(null)).toBe(0);
    expect(offsetFromRangeHeader("")).toBe(0);
  });
});

describe("classifyResponse", () => {
  it("distingue fin, suite, nouvelle tentative et échec", () => {
    expect(classifyResponse(201)).toBe("complete");
    expect(classifyResponse(200)).toBe("complete");
    expect(classifyResponse(308)).toBe("continue");
    expect(classifyResponse(503)).toBe("retry");
    expect(classifyResponse(429)).toBe("retry");
    expect(classifyResponse(403)).toBe("failed");
    expect(classifyResponse(410)).toBe("failed");
  });
});

describe("progression", () => {
  it("calcule le pourcentage", () => {
    expect(progressPct(50, 200)).toBe(25);
    expect(progressPct(0, 0)).toBe(0);
  });

  it("espace les tentatives sans dépasser le plafond", () => {
    expect(retryDelayMs(0)).toBe(5000);
    expect(retryDelayMs(1)).toBe(10000);
    expect(retryDelayMs(20)).toBe(300000);
  });
});
