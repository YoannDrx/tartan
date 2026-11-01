import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { parseReferralCode } from "../../src/lib/deep-links";
import { usePendingReferral } from "../../src/lib/pending-referral";

// Lien de parrainage : le code attend la création de l'espace ou l'arrivée dans un groupe.
export default function ReferralLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const keep = usePendingReferral((s) => s.keep);
  const parsed = parseReferralCode(code);
  useEffect(() => {
    if (parsed) keep(parsed);
  }, [parsed, keep]);
  return <Redirect href="/" />;
}
