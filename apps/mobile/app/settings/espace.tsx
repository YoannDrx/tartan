import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { m } from "@tartan/i18n";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { LinkRow } from "../../src/features/settings-rows";
import { TrainingProfileFields } from "../../src/features/training-profile-fields";
import { api } from "../../src/lib/api";
import { errorMessage } from "../../src/lib/errors";
import { useActiveSpace } from "../../src/lib/queries";
import { canOpenRubric } from "../../src/lib/settings-rubrics";
import { Button, Chip, Field, ListSurface, T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { ErrorState, LoadingState } from "../../src/ui/states";
import { space as spacing } from "../../src/ui/theme";

type Organization = Awaited<ReturnType<typeof api.organization>>;

const Editor = ({ initial }: { initial: Organization }) => {
  const [value, setValue] = useState(initial);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      api.updateOrganization(initial.id, {
        name: value.name,
        overdueReminders: value.overdueReminders,
        disciplines: value.disciplines,
        trainingObjectives: value.trainingObjectives,
        availableEquipment: value.availableEquipment,
      }),
    onSuccess: (updated) => {
      client.setQueryData(["organization", initial.id], updated);
      void client.invalidateQueries({ queryKey: ["me"] });
      // Le matériel décrit fait avancer une étape des premiers pas.
      void client.invalidateQueries({ queryKey: ["onboarding", initial.id] });
    },
  });
  const change = (patch: Partial<Organization>) => {
    save.reset();
    setValue({ ...value, ...patch });
  };
  return (
    <View style={{ gap: spacing.lg }}>
      <Field
        label={m.onboarding.orgName}
        value={value.name}
        maxLength={120}
        editable={!save.isPending}
        onChangeText={(name) => change({ name })}
      />
      <TrainingProfileFields value={value} disabled={save.isPending} onChange={change} />
      <Chip
        label={m.settings.overdueReminders}
        active={value.overdueReminders}
        onPress={() => {
          if (!save.isPending) change({ overdueReminders: !value.overdueReminders });
        }}
      />
      <T variant="caption" tone="muted">
        {m.settings.overdueRemindersDetail}
      </T>
      {save.isError ? (
        <T tone="danger" accessibilityLiveRegion="polite">
          {errorMessage(save.error)}
        </T>
      ) : null}
      {save.isSuccess ? <T accessibilityLiveRegion="polite">{m.trainingProfile.saved}</T> : null}
      <Button
        label={m.common.save}
        disabled={!value.name.trim()}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
    </View>
  );
};

// Rubrique Espace : le nom, le profil d'entraînement et les relances ; les références de force si la progression
// est ouverte.
export default function SpaceSettings() {
  const { me, space, orgId } = useActiveSpace();
  const router = useRouter();
  const allowed = space ? canOpenRubric(space.role, "espace") : false;
  const query = useQuery({
    queryKey: ["organization", orgId],
    queryFn: () => api.organization(orgId),
    enabled: Boolean(orgId && allowed),
  });
  if (!me.isPending && !allowed) return <Redirect href="/settings" />;
  return (
    <StackScreen title={m.account.settings.rubrics.espace.title}>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data ? (
        <Editor key={query.data.id} initial={query.data} />
      ) : (
        <LoadingState />
      )}
      {space?.progressionEnabled ? (
        <ListSurface>
          <LinkRow label={m.strengthMapping.title} onPress={() => router.push("/strength-mappings")} />
        </ListSurface>
      ) : null}
    </StackScreen>
  );
}
