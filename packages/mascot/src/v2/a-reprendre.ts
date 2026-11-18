// Les gestes relevés qui ne respectent pas encore toutes les contraintes, et lesquelles. Le relèvement suit des
// règles générales : ce qu'elles ne règlent pas se corrige en écrivant le geste à la main, pas par une rustine.
// Le test du registre tient cette table à jour : un geste absent d'ici doit tout respecter, et un geste listé qui
// respecte désormais une de ses contraintes fait échouer le test, pour que la liste ne pourrisse pas.
// Elle est vide depuis que les derniers gestes à reprendre sont écrits à la main.
import type { Report } from "./constraints";

export type Constraint = keyof Report;

export const A_REPRENDRE: Readonly<Record<string, readonly Constraint[]>> = {};
