import { describe, expect, it } from "vitest";
import { drawClip, lookOf, sceneSvg, svgMarkup, type DrawNode, type ScenePaint } from "./draw-svg";
import { backSquat, lateralLunge, snatch } from "./gestures";
import { gestureClip } from "./registry";
import { createMotionPlayer, svgSink, type SvgElementLike, type Ticker } from "./player";

// Des couleurs qui portent le nom de leur rôle : le test lit ce que le rendu colore.
const PAINT = new Proxy({}, { get: (_, role) => String(role) }) as ScenePaint;

// Une horloge à la main : chaque `step` fait passer une image.
const manual = () => {
  let pending: ((now: number) => void) | null = null;
  let now = 0;
  const ticker: Ticker = {
    request: (callback) => {
      pending = callback;
      return 1;
    },
    cancel: () => {
      pending = null;
    },
  };
  return {
    ticker,
    waiting: () => pending !== null,
    step(ms: number) {
      now += ms;
      const callback = pending;
      pending = null;
      callback?.(now);
    },
  };
};

// Un faux document : il compte ce que le lecteur écrit.
const fakeDocument = () => {
  const log = { created: 0, attributes: 0, appended: 0 };
  const element = (
    tag: string,
  ): SvgElementLike & { tag: string; attributes: Map<string, string>; children: SvgElementLike[] } => ({
    tag,
    attributes: new Map(),
    children: [],
    setAttribute(name, value) {
      log.attributes += 1;
      this.attributes.set(name, value);
    },
    appendChild(child) {
      log.appended += 1;
      this.children = [...this.children.filter((other) => other !== child), child];
      return child;
    },
    replaceChildren(...children) {
      this.children = children;
    },
  });
  return {
    log,
    element,
    document: {
      createElementNS: (_: string, tag: string) => {
        log.created += 1;
        return element(tag);
      },
    },
  };
};

describe("dessin d'une image", () => {
  it("un aplat par partie du corps, sans contour, la tête et le dossard posés à plat", () => {
    const nodes = drawClip(snatch, 0, "side");
    const ids = nodes.map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [
      "thighR",
      "shinL",
      "shoeR",
      "forearmL",
      "handR",
      "chest",
      "pelvis",
      "neck",
      "head",
      "bib",
      "barShaft",
      "plateR0",
    ])
      expect(ids, id).toContain(id);
    for (const node of nodes) if (node.kind === "path") expect(node.d).toMatch(/^M[-\d. ]+[AaL]/);
    expect(nodes.some((node) => node.kind === "prop")).toBe(false);
    expect(svgMarkup(nodes, PAINT)).not.toMatch(/stroke="(skin|tee|shorts)"/);
  });

  it("garde l'identité du groupe : coiffure, dossard et visage de l'athlète", () => {
    expect(lookOf(snatch, "neutral")).toEqual({ bib: 2, hair: "afro", face: "neutral" });
    expect(lookOf(backSquat, "effort")).toEqual({ bib: 4, hair: "crop", face: "effort" });
    const head = drawClip(snatch, 0, "front").find((node) => node.id === "head")!;
    expect(head.kind === "group" && head.content).toBe("head/afro/neutral/front");
    const faces = new Set(Array.from({ length: 60 }, (_, i) => snatch.face(i / 60)));
    expect([...faces].sort()).toEqual(["effort", "joy", "neutral"]);
  });

  it("de profil, les disques passent derrière l'athlète et la tête devant les bras ; de face, la profondeur décide", () => {
    const side = drawClip(snatch, 0, "side").map((node) => node.id);
    expect(side.indexOf("plateR0")).toBeLessThan(side.indexOf("thighL"));
    expect(side.at(-1)).toBe("barSleeveR");
    expect(side.indexOf("head")).toBeGreaterThan(side.indexOf("forearmR"));
    // De face, au départ de l'arraché : la barre est devant les tibias, les mains devant la barre.
    const front = drawClip(snatch, 0, "front").map((node) => node.id);
    expect(front.indexOf("barShaft")).toBeGreaterThan(front.indexOf("shinR"));
    expect(front.indexOf("handR")).toBeGreaterThan(front.indexOf("barShaft"));
    // De face, au squat : la barre est derrière la nuque.
    const squat = drawClip(backSquat, 0, "front").map((node) => node.id);
    expect(squat.indexOf("barShaft")).toBeLessThan(squat.indexOf("chest"));
    expect(squat.indexOf("barShaft")).toBeLessThan(squat.indexOf("head"));
  });

  it("de face, un disque se voit par sa tranche ; de profil, par sa face", () => {
    const d = (view: "side" | "front") => {
      const node = drawClip(snatch, 0, view).find((candidate) => candidate.id === "plateR0")!;
      return node.kind === "path" ? node.d : "";
    };
    expect(d("side")).toMatch(/a41 41 /);
    expect(d("front")).not.toMatch(/[aA]41 41 /);
  });

  it("une image complète tient dans son cadre, le sol sous les pieds", () => {
    const svg = sceneSvg(lateralLunge, 0.5, "front", PAINT);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="-?\d+ -?\d+ \d+ \d+">/);
    expect(svg).toContain('stroke="floor"');
    expect(svg).not.toMatch(/NaN|undefined/);
  });
});

describe("lecteur", () => {
  const collect = () => {
    const frames: (readonly DrawNode[])[] = [];
    return { frames, sink: { render: (nodes: readonly DrawNode[]) => void frames.push(nodes) } };
  };

  it("pose l'image de départ, puis attend la lecture", () => {
    const clock = manual();
    const { frames, sink } = collect();
    const player = createMotionPlayer(snatch, "side", sink, { ticker: clock.ticker, start: 0.25 });
    expect(frames).toHaveLength(1);
    expect(player.playing).toBe(false);
    expect(player.time).toBe(0.25);
    expect(clock.waiting()).toBe(false);
  });

  it("avance au rythme de l'horloge, à la vitesse demandée, et boucle", () => {
    const clock = manual();
    const { frames, sink } = collect();
    const seen: number[] = [];
    const options = { ticker: clock.ticker, rate: 1, onFrame: (t: number) => void seen.push(t) };
    const player = createMotionPlayer(backSquat, "front", sink, options);
    player.play();
    clock.step(16);
    expect(player.time).toBe(0);
    clock.step(50);
    expect(player.time).toBeCloseTo(50 / backSquat.duration, 9);
    options.rate = 0.5;
    clock.step(50);
    expect(player.time).toBeCloseTo(75 / backSquat.duration, 9);
    expect(frames).toHaveLength(4);
    expect(seen).toHaveLength(4);
    // Un onglet resté en arrière-plan : une seule image, au plus un dixième de seconde plus loin.
    options.rate = 1;
    clock.step(60_000);
    expect(player.time).toBeCloseTo(175 / backSquat.duration, 9);
    for (let i = 0; i < 60; i += 1) clock.step(100);
    expect(player.time).toBeGreaterThanOrEqual(0);
    expect(player.time).toBeLessThan(1);
  });

  it("s'arrête en pause, montre l'instant demandé, reprend sans saut", () => {
    const clock = manual();
    const { frames, sink } = collect();
    const player = createMotionPlayer(snatch, "side", sink, { ticker: clock.ticker });
    player.play();
    clock.step(16);
    clock.step(16);
    player.pause();
    expect(clock.waiting()).toBe(false);
    const count = frames.length;
    clock.step(500);
    expect(frames).toHaveLength(count);
    player.seek(1.5);
    expect(player.time).toBe(0.5);
    expect(frames).toHaveLength(count + 1);
    player.play();
    clock.step(5000);
    expect(player.time).toBe(0.5);
    player.dispose();
    expect(player.playing).toBe(false);
  });

  it("sans horloge d'animation, la lecture le dit clairement", () => {
    const { sink } = collect();
    expect(() => createMotionPlayer(snatch, "side", sink).play()).toThrow(/horloge/);
  });
});

describe("pose dans un SVG", () => {
  it("crée les éléments une fois, puis ne récrit que ce qui change", () => {
    const fake = fakeDocument();
    const parent = fake.element("g");
    const sink = svgSink(fake.document, parent, PAINT);
    sink.render(drawClip(snatch, 0.02, "side"));
    const created = fake.log.created;
    expect(parent.children.length).toBe(drawClip(snatch, 0.02, "side").length);

    // Pendant une tenue, rien ne bouge : aucun attribut récrit, aucun élément déplacé.
    const [attributes, appended] = [fake.log.attributes, fake.log.appended];
    sink.render(drawClip(snatch, 0.05, "side"));
    expect(fake.log.created).toBe(created);
    expect(fake.log.attributes).toBe(attributes);
    expect(fake.log.appended).toBe(appended);

    // En mouvement : des tracés changent, aucun élément n'est recréé tant que le visage reste le même.
    sink.render(drawClip(snatch, 0.2, "side"));
    sink.render(drawClip(snatch, 0.21, "side"));
    expect(fake.log.attributes).toBeGreaterThan(attributes);
    const after = fake.log.created;
    sink.render(drawClip(snatch, 0.215, "side"));
    expect(fake.log.created).toBe(after);
  });

  it("pose le matériel d'un geste relevé, et masque ce qui sort de l'image sans le détruire", () => {
    const clip = gestureClip("bench-press")!;
    const fake = fakeDocument();
    const parent = fake.element("g");
    const sink = svgSink(fake.document, parent, PAINT);
    const nodes = drawClip(clip, 0.1, "side");
    const bench = nodes.find((node) => node.kind === "prop" && node.paint === "bench")!;
    expect(bench).toBeDefined();
    sink.render(nodes);
    const created = fake.log.created;
    const element = parent.children[nodes.indexOf(bench)] as unknown as {
      tag: string;
      attributes: Map<string, string>;
    };
    expect(element.tag).toBe("rect");
    expect(element.attributes.get("fill")).toBe("bench");
    // Une image sans ce banc : l'élément reste, masqué ; il revient à l'image suivante.
    sink.render(nodes.filter((node) => node !== bench));
    expect(element.attributes.get("visibility")).toBe("hidden");
    sink.render(nodes);
    expect(element.attributes.get("visibility")).toBe("visible");
    expect(fake.log.created).toBe(created);
  });

  it("garde l'ordre d'empilement de l'image", () => {
    const fake = fakeDocument();
    const parent = fake.element("g");
    const sink = svgSink(fake.document, parent, PAINT);
    for (const t of [0, 0.3, 0.45, 0.7]) {
      const nodes = drawClip(snatch, t, "front");
      sink.render(nodes);
      expect(parent.children).toHaveLength(nodes.length);
      const head = parent.children.at(-1) as unknown as { tag: string };
      expect(["g", "path"]).toContain(head.tag);
    }
  });
});
