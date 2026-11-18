// Les gestes que le premier moteur ne dessinait que de face : écrits en trois dimensions, ils ont un vrai profil,
// avec de la profondeur, et se lisent sous deux vues.
import { describe, expect, it } from "vitest";
import { EXERCISE_CLIPS } from "../exercises";
import { GESTURES } from "./gestures";
import { gestureEntry } from "./registry";
import { SIDES } from "./solve";

const FRONT = Object.values(EXERCISE_CLIPS)
  .filter((clip) => clip.facing === "front")
  .map((clip) => clip.key);

describe("gestes dessinés de face par le premier moteur", () => {
  it("il y en a quinze, et tous sont écrits à la main", () => {
    expect(FRONT.length).toBe(15);
    for (const key of FRONT) expect(gestureEntry(key)!.level, key).toBe("ecrit");
  });

  it.each(FRONT)("%s : un profil en relief, pas une découpe plate, et deux vues", (key) => {
    const clip = GESTURES[key]!;
    // Sur la boucle, les points du corps s'étalent en profondeur (x) au moins de la longueur d'un pied et de
    // l'épaisseur du buste : la projection de profil n'est pas un trait.
    let [low, high] = [Infinity, -Infinity];
    for (let i = 0; i < 24; i += 1) {
      const body = clip.pose(i / 24);
      for (const point of [
        body.head,
        body.pelvis,
        ...SIDES.flatMap((side) => [body.arms[side].hand, body.legs[side].knee, body.legs[side].toe]),
      ]) {
        low = Math.min(low, point.x);
        high = Math.max(high, point.x);
      }
    }
    expect(high - low).toBeGreaterThan(30);
    expect(gestureEntry(key)!.views.length).toBe(2);
  });
});

describe("élévations latérales", () => {
  it("les bras montent sur les côtés jusqu'à hauteur d'épaule, un peu devant le buste, coudes à peine fléchis", () => {
    const clip = GESTURES["lateral-raise"]!;
    const top = clip.pose(
      (clip.phases.find((phase) => phase.hold && phase.id === "top")!.from +
        clip.phases.find((phase) => phase.hold && phase.id === "top")!.to) /
        2,
    );
    for (const side of SIDES) {
      const arm = top.arms[side];
      expect(Math.abs(arm.hand.y - arm.shoulder.y)).toBeLessThan(20);
      expect(arm.hand.x).toBeGreaterThan(arm.shoulder.x + 10);
      expect(arm.flexion).toBeLessThan(25);
    }
    const down = clip.phases.filter((phase) => phase.id === "down" && !phase.hold);
    const up = clip.phases.filter((phase) => phase.id === "up" && !phase.hold);
    const length = (phases: typeof up) => phases.reduce((sum, phase) => sum + phase.to - phase.from, 0);
    expect(length(down)).toBeGreaterThan(1.3 * length(up));
  });
});

describe("pas latéraux", () => {
  it.each(["lateral-band-walk", "cone-side-shuffle"])(
    "%s : un pied à la fois, sans croiser, aller et retour",
    (key) => {
      const clip = GESTURES[key]!;
      for (let i = 0; i < 120; i += 1) {
        const body = clip.pose(i / 120);
        expect(body.legs.R.ball.z).toBeGreaterThan(body.legs.L.ball.z + 10);
      }
      for (const phase of clip.phases.filter((candidate) => !candidate.hold))
        expect(phase.planted.length).toBeGreaterThan(0);
      const travel =
        Math.max(...Array.from({ length: 60 }, (_, i) => clip.pose(i / 60).pelvis.z)) - clip.pose(0).pelvis.z;
      expect(travel).toBeGreaterThan(90);
    },
  );
});

describe("ouverture de hanche couchée sur le côté", () => {
  it("les pieds restent en contact et en place, le genou du dessus monte", () => {
    const clip = GESTURES["band-clamshell"]!;
    const at = (id: string) =>
      clip.pose(
        (clip.phases.find((phase) => phase.hold && phase.id === id)!.from +
          clip.phases.find((phase) => phase.hold && phase.id === id)!.to) /
          2,
      );
    const [closed, open] = [at("closed"), at("open")];
    expect(open.legs.R.knee.y).toBeGreaterThan(closed.legs.R.knee.y + 25);
    for (const side of SIDES)
      expect(
        Math.hypot(
          open.legs[side].ball.x - closed.legs[side].ball.x,
          open.legs[side].ball.y - closed.legs[side].ball.y,
        ),
      ).toBeLessThan(1e-6);
    expect(Math.abs(open.legs.R.ankle.x - open.legs.L.ankle.x)).toBeLessThan(8);
  });
});
