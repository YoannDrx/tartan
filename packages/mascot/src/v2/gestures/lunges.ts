// Les fentes avant et arrière : Mehdi. Un grand pas, les pieds gardent leur écartement ; en bas, le tibia avant à
// peu près vertical, le genou arrière près du sol sans le toucher, talon arrière levé, buste droit ; la jambe avant
// repousse le sol pour revenir. Descente freinée, retour plus vif. Positions réglées à l'œil, d'après les fiches du
// catalogue : aucune source ouverte pour ces gestes.
import { gesture } from "../gesture";
import { BALL_X, type ControlPatch } from "../pose";
import { dumbbells } from "./gym";

const ATHLETE = "discus" as const;
const RIG = { bar: null };
const HOME = 16;
const STEP = 128;

const feet: ControlPatch = {
  footRX: BALL_X,
  footRZ: HOME,
  footRYaw: 6,
  footLX: BALL_X,
  footLZ: -HOME,
  footLYaw: 6,
};

// --- Fente avant : le pied droit part devant ---------------------------------------------------------------------

const FRONT = BALL_X + STEP;
export const forwardLunge = gesture({
  key: "forward-lunge",
  athlete: ATHLETE,
  rig: RIG,
  base: feet,
  keys: [
    { id: "standing", guide: 0, hold: 600, move: { ms: 320, curve: "reception", phase: "return" } },
    {
      id: "step",
      guide: 1,
      set: { pelvisX: 18, pelvisY: 160, pelvisPitch: 3, footRX: BALL_X + 70, footRLift: 14, footRHeel: -6 },
      air: ["R"],
      still: true,
      move: { ms: 340, curve: "elan", phase: "step" },
    },
    {
      id: "landing",
      set: { pelvisX: 36, pelvisY: 146, pelvisPitch: 4, footRX: FRONT, footLHeel: 30 },
      move: { ms: 220, curve: "linear", phase: "step" },
    },
    {
      id: "bottom",
      guide: 2,
      set: { pelvisX: 40, pelvisY: 98, pelvisPitch: 6, neck: -4, footRX: FRONT, footLHeel: 62 },
      hold: 350,
      face: "effort",
      move: { ms: 620, curve: "reception", phase: "down" },
    },
    {
      id: "push",
      guide: 3,
      set: { pelvisX: 28, pelvisY: 134, pelvisPitch: 5, footRX: FRONT, footLHeel: 40 },
      face: "effort",
      still: true,
      move: { ms: 330, curve: "elan", phase: "push" },
    },
    {
      id: "return-step",
      set: { pelvisX: 10, pelvisY: 162, pelvisPitch: 3, footRX: BALL_X + 64, footRLift: 14, footRHeel: -4 },
      air: ["R"],
      move: { ms: 280, curve: "linear", phase: "return" },
    },
  ],
});

// --- Fente arrière : le pied gauche recule, haltères le long du corps ------------------------------------------

const BACK = BALL_X - STEP - 24;
export const reverseLunge = gesture({
  key: "reverse-lunge",
  athlete: ATHLETE,
  rig: RIG,
  base: feet,
  keys: [
    { id: "standing", guide: 0, hold: 600, move: { ms: 320, curve: "reception", phase: "return" } },
    {
      id: "step",
      guide: 1,
      set: { pelvisX: -26, pelvisY: 160, pelvisPitch: 4, footLX: BALL_X - 80, footLLift: 14, footLHeel: 30 },
      air: ["L"],
      still: true,
      move: { ms: 340, curve: "elan", phase: "step" },
    },
    {
      id: "landing",
      set: { pelvisX: -62, pelvisY: 146, pelvisPitch: 5, footLX: BACK, footLHeel: 40 },
      move: { ms: 220, curve: "linear", phase: "step" },
    },
    {
      id: "bottom",
      guide: 2,
      set: { pelvisX: -84, pelvisY: 98, pelvisPitch: 7, neck: -4, footLX: BACK, footLHeel: 62 },
      hold: 350,
      face: "effort",
      move: { ms: 620, curve: "reception", phase: "down" },
    },
    {
      id: "push",
      guide: 3,
      set: { pelvisX: -66, pelvisY: 134, pelvisPitch: 5, footLX: BACK, footLHeel: 45 },
      face: "effort",
      still: true,
      move: { ms: 330, curve: "elan", phase: "push" },
    },
    {
      id: "return-step",
      set: { pelvisX: -20, pelvisY: 162, pelvisPitch: 3, footLX: BALL_X - 72, footLLift: 14, footLHeel: 20 },
      air: ["L"],
      move: { ms: 280, curve: "linear", phase: "return" },
    },
  ],
  props: (_, body) => dumbbells(body),
});
