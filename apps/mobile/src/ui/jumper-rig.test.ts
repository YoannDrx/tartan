import { BODY, JUMPER_POSES } from "@tartan/design-tokens";
import { describe, expect, it } from "vitest";
import { jumperTransforms } from "./jumper-rig";

describe("jumperTransforms", () => {
  it("applique le squelette du film à la pose de joie", () => {
    const t = jumperTransforms(JUMPER_POSES.cheer);
    expect(t.root).toBe("rotate(0) scale(1 1)");
    expect(t.lean).toBe("rotate(-2)");
    expect(t.head).toBe(`translate(0 ${-BODY.neck}) rotate(-10)`);
    expect(t.shoulder).toBe(`translate(0 ${-BODY.shoulder})`);
    expect(t.armA).toBe("rotate(-122)");
    expect(t.elbowA).toBe(`translate(0 ${BODY.arm}) rotate(-8)`);
    expect(t.armB).toBe("rotate(122)");
    expect(t.elbowB).toBe(`translate(0 ${BODY.arm}) rotate(8)`);
    expect(t.legA).toBe("rotate(-7)");
    expect(t.kneeA).toBe(`translate(0 ${BODY.thigh}) rotate(3)`);
  });

  it("retourne le corps quand la pose l'indique", () => {
    expect(jumperTransforms(JUMPER_POSES.apex).root).toBe("rotate(94) scale(-1 1)");
  });
});
