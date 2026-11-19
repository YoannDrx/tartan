// La cadence d'un geste rendu par React : au plus `fps` images par seconde. L'horloge de l'écran bat plus vite
// (60 ou 120 fois par seconde) ; ici, chaque image coûte un rendu, donc on n'en demande que ce qu'il faut pour
// que le mouvement reste fluide. Renvoie le temps écoulé à ajouter au geste, ou `null` quand l'image est sautée.
export const framePace = (fps: number) => {
  const step = 1000 / fps;
  let last: number | null = null;
  return (now: number): number | null => {
    if (last === null) {
      last = now;
      return 0;
    }
    const elapsed = now - last;
    // Une marge d'une milliseconde : une horloge à 60 Hz donne une image sur deux, pas une sur trois.
    if (elapsed < step - 1) return null;
    last = now;
    // Une application revenue de l'arrière-plan ne fait pas sauter le geste.
    return Math.min(elapsed, 100);
  };
};
