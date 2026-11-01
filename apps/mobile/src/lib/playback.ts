// Vitesse maximale du lecteur expo-video (doc de `playbackRate`) : 16×.
export const MAX_PLAYER_RATE = 16;

const SPEEDS = [
  { value: 0.1, label: "0,1×" },
  { value: 0.25, label: "0,25×" },
  { value: 0.5, label: "0,5×" },
  { value: 1, label: "1×" },
] as const;

// Le lecteur lit le fichier étiré : pour tenir une vitesse réelle, il lit `timeScale` fois plus vite.
export const playerRate = (speed: number, timeScale: number): number => Math.min(speed * timeScale, MAX_PLAYER_RATE);

// Au-delà de 480 i/s, le temps réel n'est plus atteignable : la vitesse n'est pas proposée plutôt que d'être fausse.
export const speedsFor = (timeScale: number) => {
  const reachable = SPEEDS.filter((s) => s.value * timeScale <= MAX_PLAYER_RATE);
  return reachable.length > 0 ? reachable : SPEEDS.slice(0, 1);
};

export const defaultSpeed = (timeScale: number): number => {
  const speeds = speedsFor(timeScale);
  return speeds.find((s) => s.value === 0.5)?.value ?? speeds[speeds.length - 1]!.value;
};
