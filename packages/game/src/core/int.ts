// Seul fichier du paquet où la division est permise. Toutes les grandeurs de la simulation sont des
// entiers signés sur 32 bits : les produits passent par Math.imul, les quotients par idiv.

// Quotient entier, tronqué vers zéro. Exact pour deux entiers 32 bits : le quotient flottant est
// arrondi au plus proche par IEEE 754, puis ramené à l'entier, sans dépendre du moteur.
export const idiv = (a: number, b: number): number => (a / b) | 0;

// a × num / den, tronqué. Le produit doit tenir sur 32 bits : à l'appelant de borner ses unités.
export const scale = (a: number, num: number, den: number): number => idiv(Math.imul(a, num), den);

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;
