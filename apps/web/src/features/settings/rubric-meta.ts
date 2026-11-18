import { w } from "@tartan/i18n/web";
import {
  Bell,
  Building2,
  CircleHelp,
  CreditCard,
  MonitorSmartphone,
  Palette,
  ShieldCheck,
  UserRound,
  UserRoundPlus,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { SettingsRubric } from "./sections";

// L'icône de chaque rubrique : la même dans le sommaire et dans la barre latérale.
export const RUBRIC_ICON: Record<SettingsRubric, LucideIcon> = {
  profil: UserRound,
  connexion: MonitorSmartphone,
  notifications: Bell,
  apparence: Palette,
  confidentialite: ShieldCheck,
  espace: Building2,
  groupes: UsersRound,
  membres: UserRoundPlus,
  abonnement: CreditCard,
  aide: CircleHelp,
};

export const rubricTitle = (rubric: SettingsRubric): string => w.settings.rubrics[rubric].title;
