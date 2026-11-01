// Point d'entrée : les actions de notification doivent être prêtes avant tout écran,
// car l'app peut être relancée en arrière-plan juste pour traiter un bouton.
import { startNotificationActions } from "./src/lib/notification-actions";
import "expo-router/entry";

startNotificationActions();
