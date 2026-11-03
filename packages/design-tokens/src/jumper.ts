// La mascotte de Tartan : mêmes proportions et mêmes poses sur le web et le mobile.
export const BODY = { torso: 96, shoulder: 88, neck: 132, arm: 48, forearm: 46, thigh: 62, shin: 62 };

export type JumperPose = {
  rot: number;
  flip: number;
  sx: number;
  sy: number;
  lean: number;
  head: number;
  armA: number;
  elbowA: number;
  armB: number;
  elbowB: number;
  legA: number;
  kneeA: number;
  legB: number;
  kneeB: number;
};

const STAND: JumperPose = {
  rot: 0,
  flip: 1,
  sx: 1,
  sy: 1,
  lean: 2,
  head: 0,
  armA: 12,
  elbowA: 18,
  armB: -10,
  elbowB: 18,
  legA: 7,
  kneeA: 4,
  legB: -7,
  kneeB: 4,
};

export const JUMPER_POSES = {
  stand: STAND,
  run: {
    ...STAND,
    rot: 10,
    lean: 4,
    head: -6,
    armA: -48,
    elbowA: 82,
    armB: 48,
    elbowB: 82,
    legA: 56,
    kneeA: 60,
    legB: -34,
    kneeB: 72,
  },
  apex: {
    ...STAND,
    rot: 94,
    flip: -1,
    lean: -26,
    head: -24,
    armA: 18,
    elbowA: 8,
    armB: 2,
    elbowB: 8,
    legA: -32,
    kneeA: 82,
    legB: -24,
    kneeB: 92,
  },
  landing: {
    ...STAND,
    rot: 168,
    flip: -1,
    lean: 10,
    head: 16,
    armA: 96,
    elbowA: 12,
    armB: 76,
    elbowB: 12,
    legA: 82,
    kneeA: 22,
    legB: 92,
    kneeB: 14,
  },
  cheer: {
    ...STAND,
    lean: -2,
    head: -10,
    armA: 122,
    elbowA: 8,
    armB: -122,
    elbowB: -8,
    legA: 7,
    kneeA: 3,
    legB: -7,
    kneeB: 3,
  },
} satisfies Record<string, JumperPose>;

export type JumperPoseName = keyof typeof JUMPER_POSES;
