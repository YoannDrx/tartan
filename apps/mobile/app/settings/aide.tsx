import { isStaff } from "@tartan/domain";
import { m } from "@tartan/i18n";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { LinkRow } from "../../src/features/settings-rows";
import { config } from "../../src/lib/config";
import { legalLinks } from "../../src/lib/legal-links";
import { isPersonalSpace } from "../../src/lib/personal-space";
import { useActiveSpace } from "../../src/lib/queries";
import { Divider, ListSurface, SectionTitle, T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { space } from "../../src/ui/theme";

const t = m.account.settings;

// Rubrique Aide : les premiers pas du coach, le centre d'aide, le contact, les nouveautés et la synchronisation.
export default function HelpSettings() {
  const { space: active } = useActiveSpace();
  const router = useRouter();
  const links = legalLinks(config.webUrl);
  return (
    <StackScreen title={t.rubrics.aide.title}>
      {active && (isStaff(active.role) || isPersonalSpace(active)) ? (
        <ListSurface>
          <LinkRow
            testID="open-first-steps"
            label={t.firstSteps}
            detail={isPersonalSpace(active) ? m.mobile.solo.guide.settingsDetail : t.firstStepsDetail}
            onPress={() => router.push("/premiers-pas")}
          />
        </ListSurface>
      ) : null}
      <View style={{ gap: space.sm }}>
        <SectionTitle>{m.settings.help}</SectionTitle>
        <T variant="small">{m.settings.helpDetail}</T>
        <ListSurface>
          <LinkRow
            label={m.help.center}
            detail={t.helpCenterDetail}
            onPress={() => void WebBrowser.openBrowserAsync(links.help)}
          />
          <Divider />
          <LinkRow label={m.legal.contact} onPress={() => void WebBrowser.openBrowserAsync(links.contact)} />
          <Divider />
          <LinkRow label={m.releases.title} detail={t.releasesDetail} onPress={() => router.push("/nouveautes")} />
          <Divider />
          <LinkRow label={m.syncReview.title} detail={t.syncDetail} onPress={() => router.push("/sync-review")} />
        </ListSurface>
      </View>
    </StackScreen>
  );
}
