// Tout changement de règle, de constante ou d'arrondi change les scores : il faut alors monter ce numéro.
// Un journal n'est rejouable qu'avec la version qui l'a produit.
export const SIM_VERSION = 1;

// Pas fixe : le rendu peut tourner à n'importe quelle cadence, la partie avance toujours par 1/120 s.
export const TICK_HZ = 120;

// Une partie dure 90 s au plus.
export const MAX_TICKS = 10_800;

// Un journal porte 2 000 changements d'appui au plus.
export const MAX_LOG_EVENTS = 2_000;

// Deux canaux d'appui au plus : bit 0 et bit 1 du masque d'entrée.
export const MAX_CHANNELS = 2;

// Les graines sont des entiers non signés sur 32 bits.
export const MAX_SEED = 0xffff_ffff;
