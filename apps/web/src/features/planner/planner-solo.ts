"use client";

import { createContext } from "react";

// L'athlète autonome, dans son espace personnel : la séance proposée est pour lui, sans destinataires à choisir.
// La demande et la relecture cachent alors le choix « pour qui » ; le serveur l'impose de toute façon.
export const PlannerSolo = createContext(false);
