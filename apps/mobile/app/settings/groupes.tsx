import { m } from "@tartan/i18n";
import { Redirect, useRouter } from "expo-router";
import { View } from "react-native";
import { LinkRow } from "../../src/features/settings-rows";
import { useActiveSpace, useGroups } from "../../src/lib/queries";
import { canOpenRubric } from "../../src/lib/settings-rubrics";
import { Divider, ListSurface, T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { ErrorState, LoadingState } from "../../src/ui/states";
import { space } from "../../src/ui/theme";

const t = m.account.settings;

// Rubrique Groupes : chaque groupe mène à son lien et à son QR code d'invitation.
export default function GroupSettings() {
  const { me, space: active, orgId } = useActiveSpace();
  const router = useRouter();
  const allowed = active ? canOpenRubric(active.role, "groupes") : false;
  const groups = useGroups(allowed ? orgId : "");
  if (!me.isPending && !allowed) return <Redirect href="/settings" />;
  return (
    <StackScreen title={t.rubrics.groupes.title}>
      <T variant="small">{t.groupsDetail}</T>
      {groups.isError ? (
        <ErrorState error={groups.error} onRetry={() => void groups.refetch()} />
      ) : !groups.data ? (
        <LoadingState />
      ) : groups.data.length === 0 ? (
        <T>{t.groupsEmpty}</T>
      ) : (
        <ListSurface>
          {groups.data.map((group, index) => (
            <View key={group.id}>
              {index > 0 ? <Divider /> : null}
              <LinkRow
                testID={`settings-group-${index}`}
                label={group.name}
                detail={t.groupAthletes(group.athleteCount)}
                onPress={() => router.push({ pathname: "/invite", params: { groupId: group.id } })}
              />
            </View>
          ))}
        </ListSurface>
      )}
      <View style={{ height: space.sm }} />
    </StackScreen>
  );
}
