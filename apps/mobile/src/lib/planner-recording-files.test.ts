import { beforeEach, expect, it, vi } from "vitest";

const disk = vi.hoisted(() => ({ files: new Map<string, string[]>(), removed: [] as string[], fails: false }));
vi.mock("expo-file-system", () => {
  class File {
    constructor(readonly name: string) {}
    delete() {
      if (disk.fails) throw new Error("locked");
      disk.removed.push(this.name);
    }
  }
  class Directory {
    uri: string;
    constructor(parent: string | Directory, suffix?: string) {
      this.uri = `${typeof parent === "string" ? parent : parent.uri}${suffix ? `/${suffix}` : ""}`;
    }
    get exists() {
      return disk.files.has(this.uri);
    }
    list() {
      return (disk.files.get(this.uri) ?? []).map((name) => new File(name));
    }
  }
  return { File, Directory, Paths: { cache: new Directory("cache") } };
});

import { claimPlannerRecorder, purgeAbandonedPlannerRecordings } from "./planner-recording-files";

beforeEach(() => {
  disk.files.clear();
  disk.removed = [];
  disk.fails = false;
});

it("nettoie les dictées iOS et Android après un arrêt sans supprimer les autres médias", () => {
  disk.files.set("cache", ["recording-ios.tartan.m4a", "recording-video.m4a", "film.mp4"]);
  disk.files.set("cache/Audio", ["recording-android.tartan.m4a", "recording-other.m4a"]);
  purgeAbandonedPlannerRecordings();
  expect(disk.removed).toEqual(["recording-ios.tartan.m4a", "recording-android.tartan.m4a"]);
});

it("une seule capture possède le micro ; un nettoyage concurrent ne supprime pas son fichier", () => {
  const release = claimPlannerRecorder();
  try {
    disk.files.set("cache", ["recording-active.tartan.m4a"]);
    purgeAbandonedPlannerRecordings();
    expect(disk.removed).toEqual([]);
    expect(() => claimPlannerRecorder()).toThrow("dictation_busy");
  } finally {
    release();
  }
  purgeAbandonedPlannerRecordings();
  expect(disk.removed).toEqual(["recording-active.tartan.m4a"]);
});

it("un fichier impossible à effacer bloque une nouvelle capture jusqu'à la reprise du nettoyage", () => {
  disk.files.set("cache", ["recording-orphan.tartan.m4a"]);
  disk.fails = true;
  expect(() => claimPlannerRecorder()).toThrow("dictation_cleanup_failed");
  disk.fails = false;
  const release = claimPlannerRecorder();
  release();
  expect(disk.removed).toEqual(["recording-orphan.tartan.m4a"]);
});
