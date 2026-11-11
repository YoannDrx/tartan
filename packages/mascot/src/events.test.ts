import { describe, expect, it } from "vitest";
import { DISCUS, DISCUS_TIMES, discusAt } from "./discus";
import { EVENT_IDS, hipOn, phaseAt, type EventClip } from "./event";
import { CLIPS } from "./events";
import { HIGH_JUMP_BAR } from "./high-jump-event";
import { HURDLE_TOP, HURDLES } from "./hurdles";
import { LONG_JUMP, LONG_JUMP_TIMES } from "./long-jump";
import { POLE_VAULT, POLE_VAULT_TIMES, poleAt, poleChord } from "./pole-vault";
import { jointPositions, type Anchor, type Point, type Pose } from "./skeleton";
import { TRIPLE_JUMP, TRIPLE_JUMP_TIMES } from "./triple-jump";

const STEPS = 2000;
const times = (from = 0, to = 1) => Array.from({ length: STEPS + 1 }, (_, i) => from + ((to - from) * i) / STEPS);
const joints = (clip: EventClip, t: number) => {
  const { pose, root } = clip.frame(t);
  return jointPositions(pose, root);
};
const ANGLES: Array<keyof Pose> = [
  "rot",
  "lean",
  "head",
  "armA",
  "elbowA",
  "armB",
  "elbowB",
  "legA",
  "kneeA",
  "legB",
  "kneeB",
];

describe.each(EVENT_IDS.map((id) => [id, CLIPS[id]] as const))("le geste %s", (id, clip) => {
  it("porte son nom et découpe tout le geste en phases qui se suivent", () => {
    expect(clip.id).toBe(id);
    expect(clip.phases[0]!.from).toBe(0);
    expect(clip.phases[clip.phases.length - 1]!.to).toBe(1);
    clip.phases.forEach((phase, index) => {
      expect(phase.to).toBeGreaterThan(phase.from);
      if (index > 0) expect(phase.from).toBeCloseTo(clip.phases[index - 1]!.to, 9);
    });
    expect(phaseAt(clip, 0).name).toBe("ready");
    expect(phaseAt(clip, 1).name).toBe("celebrate");
    expect(clip.still).toBeGreaterThan(0);
    expect(clip.still).toBeLessThan(1);
    expect(clip.duration).toBeGreaterThan(2000);
  });

  it("commence au calme et finit les bras en l'air, le visage avec", () => {
    expect(clip.face(0)).toBe("neutral");
    expect(clip.face(clip.still)).toBe("effort");
    expect(clip.face(1)).toBe("joy");
    const start = joints(clip, 0);
    expect(start.head.y).toBeLessThan(start.pelvis.y);
    const end = joints(clip, 1);
    expect(end.handA.y).toBeLessThan(end.head.y);
    expect(end.handB.y).toBeLessThan(end.head.y);
    // Hors du geste, l'image est celle du bord.
    expect(clip.frame(-1)).toEqual(clip.frame(0));
    expect(clip.frame(2)).toEqual(clip.frame(1));
  });

  it("ne saute jamais d'une image à la suivante", () => {
    let previous = clip.frame(0);
    for (const t of times().slice(1)) {
      const next = clip.frame(t);
      expect(Math.hypot(next.root.x - previous.root.x, next.root.y - previous.root.y)).toBeLessThan(9);
      for (const angle of ANGLES) expect(Math.abs(next.pose[angle] - previous.pose[angle])).toBeLessThan(12);
      expect(Math.abs(next.pose.flip)).toBeLessThanOrEqual(1);
      previous = next;
    }
  });

  it("garde l'athlète dans la scène et au-dessus du sol", () => {
    const { width, height, ground } = clip.stage;
    expect(height).toBeGreaterThan(ground);
    for (const t of times()) {
      const at = joints(clip, t);
      for (const name of Object.keys(at) as Anchor[]) {
        expect(at[name].x).toBeGreaterThan(-20);
        expect(at[name].x).toBeLessThan(width + 20);
        expect(at[name].y).toBeGreaterThan(0);
      }
      // La cheville d'un pied à plat est 16 unités au-dessus du sol.
      expect(Math.max(at.footA.y, at.footB.y)).toBeLessThan(ground + 2);
    }
  });

  it("pose ses accessoires dans la scène, à chaque instant", () => {
    for (const t of [0, clip.still, 1]) {
      const props = clip.props(t);
      expect(props.length).toBeGreaterThan(0);
      for (const shape of props) {
        const points: Point[] =
          shape.kind === "line" || shape.kind === "curve" ? [shape.from, shape.to] : [{ x: shape.x, y: shape.y }];
        for (const point of points) {
          expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
          expect(point.y).toBeLessThan(clip.stage.height);
        }
      }
    }
  });
});

describe("les haies", () => {
  const clip = CLIPS.hurdles;
  it("passent sous les deux pieds et sous le bassin", () => {
    for (const hurdle of HURDLES) {
      let crossed = 0;
      for (const t of times()) {
        const at = joints(clip, t);
        for (const point of [at.footA, at.footB, at.pelvis]) {
          if (Math.abs(point.x - hurdle) > 14) continue;
          crossed += 1;
          expect(point.y).toBeLessThan(HURDLE_TOP - 12);
        }
      }
      expect(crossed).toBeGreaterThan(6);
    }
  });

  it("se franchissent sans casser la course : le bassin ne monte que de ce qu'il faut", () => {
    const hip = hipOn(clip.stage.ground);
    const top = Math.min(...times().map((t) => clip.frame(t).root.y));
    expect(hip - top).toBeGreaterThan(50);
    expect(hip - top).toBeLessThan(110);
  });
});

describe("la longueur", () => {
  const clip = CLIPS.longJump;
  const ankle = clip.stage.ground - 16;
  it("prend son appel sur la planche, sans mordre", () => {
    for (const t of [LONG_JUMP_TIMES.plant, LONG_JUMP_TIMES.takeoff]) {
      const foot = joints(clip, t).footA;
      expect(foot.x).toBeLessThanOrEqual(LONG_JUMP.foul);
      expect(foot.x).toBeGreaterThan(LONG_JUMP.foul - 40);
      expect(Math.abs(foot.y - ankle)).toBeLessThan(10);
    }
  });

  it("vole au-dessus de la piste et retombe dans le sable, les talons devant le bassin", () => {
    for (const t of times(LONG_JUMP_TIMES.takeoff + 0.03, LONG_JUMP_TIMES.touch - 0.03)) {
      const at = joints(clip, t);
      expect(Math.max(at.footA.y, at.footB.y)).toBeLessThan(ankle - 20);
    }
    const apex = clip.frame(LONG_JUMP_TIMES.apex).root.y;
    expect(hipOn(clip.stage.ground) - apex).toBeGreaterThan(120);
    const touch = joints(clip, LONG_JUMP_TIMES.touch);
    expect(touch.footA.x).toBeGreaterThan(LONG_JUMP.pit.from);
    expect(touch.footA.x).toBeLessThan(LONG_JUMP.pit.to);
    expect(touch.footA.x).toBeGreaterThan(touch.pelvis.x);
    expect(joints(clip, 1).footA.x).toBeLessThan(LONG_JUMP.pit.to);
  });
});

describe("le triple saut", () => {
  const clip = CLIPS.tripleJump;
  const ankle = clip.stage.ground - 16;
  it("retombe sur le pied d'appel, puis sur l'autre, puis dans le sable", () => {
    const at = TRIPLE_JUMP_TIMES;
    const takeoff = joints(clip, at.plant);
    expect(takeoff.footA.x).toBeLessThanOrEqual(TRIPLE_JUMP.foul);
    const hop = joints(clip, at.hopLand);
    expect(Math.abs(hop.footA.y - ankle)).toBeLessThan(2);
    expect(hop.footB.y).toBeLessThan(ankle - 30);
    expect(hop.footA.x).toBeCloseTo(TRIPLE_JUMP.hop, 6);
    const step = joints(clip, at.stepLand);
    expect(Math.abs(step.footB.y - ankle)).toBeLessThan(2);
    expect(step.footA.y).toBeLessThan(ankle - 30);
    expect(step.footB.x).toBeCloseTo(TRIPLE_JUMP.step, 6);
    const sand = joints(clip, at.touch);
    expect(sand.footA.x).toBeGreaterThan(TRIPLE_JUMP.pit.from);
    expect(TRIPLE_JUMP.foul).toBeLessThan(TRIPLE_JUMP.hop);
    expect(TRIPLE_JUMP.hop).toBeLessThan(TRIPLE_JUMP.step);
    expect(TRIPLE_JUMP.step).toBeLessThan(TRIPLE_JUMP.pit.from);
  });

  it("quitte le sol entre chaque appui", () => {
    const at = TRIPLE_JUMP_TIMES;
    for (const [from, to] of [
      [at.takeoff, at.hopLand],
      [at.hopOff, at.stepLand],
      [at.stepOff, at.touch],
    ] as const) {
      const middle = joints(clip, (from + to) / 2);
      expect(Math.max(middle.footA.y, middle.footB.y)).toBeLessThan(ankle - 20);
    }
  });
});

describe("la perche", () => {
  const clip = CLIPS.poleVault;
  const { plant, release } = POLE_VAULT_TIMES;
  it("plie sans jamais s'allonger, tant que l'athlète la tient", () => {
    const chords = times(plant, release).map(poleChord);
    expect(Math.max(...chords)).toBeLessThan(POLE_VAULT.grip * 1.03);
    expect(Math.min(...chords)).toBeLessThan(POLE_VAULT.grip * 0.86);
    // Au plus plié, elle bombe du côté du tapis.
    const bent = poleAt((plant + release) / 2);
    expect(bent.control.x).toBeGreaterThan((bent.from.x + bent.to.x) / 2);
    expect(bent.from).toEqual(POLE_VAULT.box);
  });

  it("reste plantée dans le butoir, puis retombe du côté de la piste", () => {
    for (const t of times(plant, 1)) expect(poleAt(t).from).toEqual(POLE_VAULT.box);
    const top = (t: number) => poleAt(t).to;
    expect(top(1).x).toBeLessThan(top(release + 0.01).x);
    expect(top(1).x).toBeLessThan(POLE_VAULT.box.x);
    // Portée, sa pointe est haute au départ.
    expect(poleAt(0.1).from.y).toBeLessThan(clip.frame(0.1).root.y);
  });

  it("fait passer le bassin au-dessus de la barre, et retomber sur le tapis", () => {
    const { far, near } = POLE_VAULT.bar;
    let above = 0;
    for (const t of times(release, POLE_VAULT_TIMES.impact)) {
      const { root } = clip.frame(t);
      if (root.x < far.x || root.x > near.x) continue;
      above += 1;
      // La barre est vue de trois quarts : sa hauteur à l'écran dépend de l'endroit où on la croise.
      const bar = far.y + ((root.x - far.x) / (near.x - far.x)) * (near.y - far.y);
      expect(root.y).toBeLessThan(bar - 40);
    }
    expect(above).toBeGreaterThan(10);
    const end = joints(clip, 1);
    expect(end.pelvis.x).toBeGreaterThan(POLE_VAULT.mat.from);
    expect(end.footA.y).toBeLessThan(POLE_VAULT.mat.top + 10);
  });
});

describe("le disque", () => {
  const clip = CLIPS.discus;
  it("reste dans la main jusqu'au lâcher, puis monte et retombe dans le secteur", () => {
    for (const t of [0, 0.2, DISCUS_TIMES.power, DISCUS_TIMES.release]) {
      expect(discusAt(t)).toEqual(joints(clip, t).handA);
    }
    const released = discusAt(DISCUS_TIMES.release);
    const heights = times(DISCUS_TIMES.release, DISCUS_TIMES.land).map((t) => discusAt(t).y);
    expect(released.y - Math.min(...heights)).toBeGreaterThan(150);
    expect(discusAt(DISCUS_TIMES.land)).toEqual(DISCUS.landing);
    expect(discusAt(1)).toEqual(DISCUS.landing);
    expect(DISCUS.landing.x).toBeGreaterThan(DISCUS.circle.to + 500);
  });

  it("fait une volte et demie sans sortir du cercle", () => {
    let turns = 0;
    let side = Math.sign(clip.frame(0).pose.flip);
    expect(side).toBe(-1);
    for (const t of times()) {
      const { pose, root } = clip.frame(t);
      expect(root.x).toBeGreaterThan(DISCUS.circle.from);
      expect(root.x).toBeLessThan(DISCUS.circle.to);
      const now = Math.sign(pose.flip);
      if (now !== 0 && now !== side) {
        turns += 1;
        side = now;
      }
    }
    expect(turns).toBe(3);
    expect(side).toBe(1);
  });
});

describe("la hauteur", () => {
  it("fait passer le bassin au-dessus de la barre", () => {
    const clip = CLIPS.highJump;
    const { far, near } = HIGH_JUMP_BAR;
    const apex = clip.frame(clip.still).root;
    const bar = far.y + ((apex.x - far.x) / (near.x - far.x)) * (near.y - far.y);
    expect(apex.x).toBeGreaterThan(far.x);
    expect(apex.x).toBeLessThan(near.x);
    expect(apex.y).toBeLessThan(bar - 60);
  });
});
