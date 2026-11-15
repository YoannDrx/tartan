import { m } from "@tartan/i18n";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { View } from "react-native";
import { sessionHeaders } from "../lib/api";
import { config } from "../lib/config";
import { Button, T } from "../ui/primitives";

// La carte d'un record personnel : l'image rendue par le serveur, téléchargée avec la session, puis la feuille
// de partage du téléphone. Rien n'est gardé : le fichier vit dans le cache.
export function ShareRecord({
  orgId,
  athleteId,
  performanceId,
  discipline,
}: {
  orgId: string;
  athleteId: string;
  performanceId: string;
  discipline: string;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const share = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const target = new File(Paths.cache, `record-${performanceId}.png`);
      if (target.exists) target.delete();
      const image = await File.downloadFileAsync(
        `${config.apiUrl}/api/v1/orgs/${orgId}/athletes/${athleteId}/performances/${performanceId}/carte`,
        target,
        { headers: await sessionHeaders() },
      );
      await Sharing.shareAsync(image.uri, {
        mimeType: "image/png",
        UTI: "public.png",
        dialogTitle: m.recordCard.shareTitle(discipline),
      });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 2, alignItems: "flex-start" }}>
      <Button
        testID={`share-record-${performanceId}`}
        label={m.recordCard.share}
        accessibilityLabel={m.recordCard.shareLabel(discipline)}
        variant="secondary"
        compact
        loading={busy}
        onPress={() => void share()}
      />
      {failed ? (
        <T variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {m.recordCard.failed}
        </T>
      ) : null}
    </View>
  );
}
