// Le temps d'un geste : des clés, et entre deux clés une transition qui a sa durée et sa courbe.
// Une clé est une tenue (le corps s'y arrête, vraiment immobile, le temps donné) ou une traversée (il y passe
// sans s'arrêter, à vitesse continue). La dynamique vient d'abord des durées : une transition courte est rapide.
// Les courbes portent les noms des jetons de mouvement du design et disent où la vitesse se loge :
// l'élan arrive lancé sur la clé suivante, la réception entre lancée et s'amortit, l'impulsion part de l'arrêt et
// y revient. Ce ne sont pas les courbes de Bézier de l'interface : un corps ne démarre pas à pleine vitesse.

export type Curve = "elan" | "impulsion" | "reception" | "linear";

// Ce qu'une courbe demande à la vitesse de traversée, à son début et à sa fin : un multiple de la vitesse
// naturelle du passage (zéro : un arrêt).
const WANTED: Record<Curve, { start: number; end: number }> = {
  elan: { start: 1, end: 1.3 },
  impulsion: { start: 0, end: 0 },
  reception: { start: 1.3, end: 1 },
  linear: { start: 1, end: 1 },
};
// La vitesse à une clé ne dépasse pas ce multiple de la vitesse moyenne de ses deux transitions : au-delà,
// une valeur dépasserait sa clé avant d'y revenir.
const STEEPEST = 2.1;

export type TimedKey<K extends string> = {
  value: Record<K, number>;
  // La durée de la tenue, en millisecondes. Zéro : une traversée.
  hold: number;
  // La transition qui mène à cette clé depuis la précédente (depuis la dernière, pour la première).
  move: { ms: number; curve: Curve };
};

// Un tronçon de la boucle : la tenue d'une clé, ou la transition qui mène à elle.
export type Span = { kind: "hold" | "move"; key: number; from: number; to: number };

export type Timeline<K extends string> = {
  // La durée de la boucle, en millisecondes.
  duration: number;
  spans: readonly Span[];
  spanAt(t: number): Span;
  // Les valeurs à l'instant `t` de la boucle, de 0 à 1.
  sample(t: number): Record<K, number>;
};

export const timeline = <K extends string>(keys: readonly TimedKey<K>[]): Timeline<K> => {
  const count = keys.length;
  if (count < 2) throw new Error("Un geste a au moins deux clés.");
  const wrap = (index: number) => ((index % count) + count) % count;
  const channels = Object.keys(keys[0]!.value) as K[];

  // La vitesse de chaque valeur à chaque clé, par milliseconde. Nulle sur une tenue ; sur une traversée, la
  // moyenne harmonique des vitesses moyennes des deux transitions voisines, pondérée par leurs durées : une
  // interpolation monotone, sans dépassement. Entre deux clés, une valeur ne sort jamais de l'intervalle qu'elles
  // bornent : un genou tendu ne passe pas en hyperextension, un disque posé ne s'enfonce pas.
  const speed = {} as Record<K, number[]>;
  for (const channel of channels) {
    speed[channel] = keys.map((key, index) => {
      if (key.hold > 0) return 0;
      const [into, out] = [key.move, keys[wrap(index + 1)]!.move];
      const before = (key.value[channel] - keys[wrap(index - 1)]!.value[channel]) / into.ms;
      const after = (keys[wrap(index + 1)]!.value[channel] - key.value[channel]) / out.ms;
      if (before * after <= 0) return 0;
      const [near, far] = [2 * out.ms + into.ms, out.ms + 2 * into.ms];
      const natural = (near + far) / (near / before + far / after);
      const wanted = natural * WANTED[into.curve].end * WANTED[out.curve].start;
      const limit = STEEPEST * Math.min(Math.abs(before), Math.abs(after));
      return Math.sign(wanted) * Math.min(Math.abs(wanted), limit);
    });
  }

  const spans: Span[] = [];
  let clock = 0;
  keys.forEach((key, index) => {
    // La boucle commence sur la première clé ; la transition qui y ramène vient donc en dernier.
    if (index > 0) {
      spans.push({ kind: "move", key: index, from: clock, to: clock + key.move.ms });
      clock += key.move.ms;
    }
    if (key.hold > 0) {
      spans.push({ kind: "hold", key: index, from: clock, to: clock + key.hold });
      clock += key.hold;
    }
  });
  spans.push({ kind: "move", key: 0, from: clock, to: clock + keys[0]!.move.ms });
  const duration = clock + keys[0]!.move.ms;

  const spanAt = (t: number): Span => {
    const time = (((t % 1) + 1) % 1) * duration;
    return spans.find((span) => time < span.to) ?? spans[spans.length - 1]!;
  };

  const sample = (t: number): Record<K, number> => {
    const time = (((t % 1) + 1) % 1) * duration;
    const span = spans.find((candidate) => time < candidate.to) ?? spans[spans.length - 1]!;
    const to = keys[span.key]!;
    if (span.kind === "hold") return { ...to.value };
    const start = wrap(span.key - 1);
    const from = keys[start]!;
    const ms = to.move.ms;
    const u = (time - span.from) / ms;
    const [u2, u3] = [u * u, u * u * u];
    const out = {} as Record<K, number>;
    for (const channel of channels) {
      out[channel] =
        (2 * u3 - 3 * u2 + 1) * from.value[channel] +
        (u3 - 2 * u2 + u) * ms * speed[channel][start]! +
        (-2 * u3 + 3 * u2) * to.value[channel] +
        (u3 - u2) * ms * speed[channel][span.key]!;
    }
    return out;
  };

  return { duration, spans, spanAt, sample };
};
