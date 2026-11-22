import { Redirect } from "expo-router";

// L'ancienne adresse des réglages de l'espace : elle mène à la rubrique Espace.
export default function OrganizationSettings() {
  return <Redirect href="/settings/espace" />;
}
