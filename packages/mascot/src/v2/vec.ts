// Trois dimensions, le strict nécessaire. Le corps regarde vers +x, le haut est +y, son côté droit est +z.
export type Vec3 = { x: number; y: number; z: number };

export const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const length = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
export const distance = (a: Vec3, b: Vec3) => length(sub(a, b));
export const normalize = (a: Vec3): Vec3 => {
  const size = length(a);
  return size < 1e-9 ? { x: 0, y: 0, z: 0 } : scale(a, 1 / size);
};
export const mix = (a: Vec3, b: Vec3, u: number): Vec3 => add(a, scale(sub(b, a), u));
// Le point `origin`, déplacé de `forward`, `up` et `side` le long des axes d'un repère.
export const along = (origin: Vec3, frame: Frame, forward: number, up: number, side: number): Vec3 => ({
  x: origin.x + frame.f.x * forward + frame.u.x * up + frame.s.x * side,
  y: origin.y + frame.f.y * forward + frame.u.y * up + frame.s.y * side,
  z: origin.z + frame.f.z * forward + frame.u.z * up + frame.s.z * side,
});

export const radians = (degrees: number) => (degrees * Math.PI) / 180;
export const degrees = (angle: number) => (angle * 180) / Math.PI;

// Un repère : l'avant, le haut et le côté droit d'un segment du corps.
export type Frame = { f: Vec3; u: Vec3; s: Vec3 };

export const WORLD: Frame = { f: vec(1, 0, 0), u: vec(0, 1, 0), s: vec(0, 0, 1) };

const turn = (a: Vec3, b: Vec3, angle: number): [Vec3, Vec3] => {
  const [c, s] = [Math.cos(radians(angle)), Math.sin(radians(angle))];
  return [add(scale(a, c), scale(b, s)), sub(scale(b, c), scale(a, s))];
};
// Se pencher vers l'avant : le haut bascule vers l'avant.
export const pitch = (frame: Frame, angle: number): Frame => {
  const [u, f] = turn(frame.u, frame.f, angle);
  return { f, u, s: frame.s };
};
// S'incliner sur le côté : le haut bascule vers la droite.
export const roll = (frame: Frame, angle: number): Frame => {
  const [u, s] = turn(frame.u, frame.s, angle);
  return { f: frame.f, u, s };
};
// Pivoter : l'avant tourne vers la droite.
export const yaw = (frame: Frame, angle: number): Frame => {
  const [f, s] = turn(frame.f, frame.s, angle);
  return { f, u: frame.u, s };
};
