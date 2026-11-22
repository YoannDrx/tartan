import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { m } from "@tartan/i18n";
import { Redirect } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { TrainingProfileFields } from "../src/features/training-profile-fields";
import { api } from "../src/lib/api";
import { errorMessage } from "../src/lib/errors";
import { useActiveSpace } from "../src/lib/queries";
import { Button, Chip, Field, T } from "../src/ui/primitives";
import { StackScreen } from "../src/ui/screen";
import { ErrorState, LoadingState } from "../src/ui/states";
import { space as spacing } from "../src/ui/theme";

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

export default function OrganizationSettings() {
  const { me, space, orgId } = useActiveSpace();
  const query = useQuery({
    queryKey: ["organization", orgId],
    queryFn: () => api.organization(orgId),
    enabled: Boolean(orgId && space?.role === "owner"),
  });
  if (!me.isPending && space?.role !== "owner") return <Redirect href="/settings" />;
  return (
    <StackScreen title={m.trainingProfile.settings}>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data ? (
        <Editor key={query.data.id} initial={query.data} />
      ) : (
        <LoadingState />
      )}
    </StackScreen>
  );
}
