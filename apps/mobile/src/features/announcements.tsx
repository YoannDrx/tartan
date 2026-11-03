import { useMutation, useQueryClient } from "@tanstack/react-query";
import { capitalize, formatDayMonth, m } from "@tartan/i18n";
import { useState } from "react";
import { Switch, View } from "react-native";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { useActiveSpace, useAnnouncements, useGroups } from "../lib/queries";
import { MoreHorizontal, Pin, Plus } from "../ui/icons";
import { Button, Chip, Divider, Field, IconButton, ListSurface, T, Tag } from "../ui/primitives";
import { TabScreen } from "../ui/screen";
import { Sheet } from "../ui/sheet";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";
import { scene, space } from "../ui/theme";
import { ModerationSheet } from "./comments";

const PublishSheet = ({ orgId, onClose }: { orgId: string; onClose: () => void }) => {
  const groups = useGroups(orgId);
  const client = useQueryClient();
  const [groupId, setGroupId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [errors, setErrors] = useState<{ group?: string; body?: string; form?: string }>({});
  const onlyGroup = groups.data?.length === 1 ? groups.data[0]?.id : null;
  const selected = groupId ?? onlyGroup ?? null;
  const publish = useMutation({
    mutationFn: () => api.publishAnnouncement(orgId, { groupId: selected as string, body: body.trim(), pinned }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["announcements", orgId] });
      onClose();
    },
    onError: (error) => setErrors({ form: errorMessage(error) }),
  });
  const submit = () => {
    const next: typeof errors = {};
    if (!selected) next.group = m.mobile.announcements.groupRequired;
    if (!body.trim()) next.body = m.mobile.forms.announcementRequired;
    setErrors(next);
    if (Object.keys(next).length === 0) publish.mutate();
  };
  return (
    <Sheet
      visible
      title={m.announcements.new}
      onClose={onClose}
      footer={<Button label={m.announcements.publish} loading={publish.isPending} onPress={submit} />}
    >
      <View style={{ gap: space.sm }}>
        <T variant="smallStrong">{m.mobile.announcements.group}</T>
        {groups.isPending ? <LoadingState inline /> : null}
        {groups.data?.length === 0 ? (
          <T variant="small" tone="muted">
            {m.mobile.coach.noGroup}
          </T>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {groups.data?.map((g) => (
            <Chip key={g.id} tall label={g.name} active={selected === g.id} onPress={() => setGroupId(g.id)} />
          ))}
        </View>
        {errors.group ? (
          <T variant="caption" tone="danger">
            {errors.group}
          </T>
        ) : null}
      </View>
      <Field
        label={m.mobile.announcements.bodyLabel}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={2000}
        placeholder={m.announcements.placeholder}
        error={errors.body}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 }}>
        <T variant="small" style={{ flex: 1 }}>
          {m.announcements.pin}
        </T>
        <Switch
          value={pinned}
          onValueChange={setPinned}
          trackColor={{ true: scene.actionOnCard, false: scene.controlLine }}
          thumbColor={pinned ? scene.onActionOnCard : scene.text}
          accessibilityLabel={m.announcements.pin}
        />
      </View>
      {errors.form ? (
        <T variant="small" tone="danger">
          {errors.form}
        </T>
      ) : null}
    </Sheet>
  );
};

export const AnnouncementsScreen = ({ canPublish }: { canPublish: boolean }) => {
  const { orgId } = useActiveSpace();
  const announcements = useAnnouncements(orgId);
  const [publishing, setPublishing] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);
  return (
    <TabScreen
      world="craie"
      title={m.announcements.title}
      refreshing={announcements.isRefetching}
      onRefresh={() => void announcements.refetch()}
      right={
        canPublish ? (
          <IconButton icon={Plus} label={m.announcements.new} tone="accent" onPress={() => setPublishing(true)} />
        ) : undefined
      }
    >
      {announcements.isPending ? <LoadingState /> : null}
      {announcements.isError && !announcements.data ? (
        <ErrorState error={announcements.error} onRetry={() => void announcements.refetch()} />
      ) : null}
      {announcements.data?.length === 0 ? <EmptyState body={m.announcements.empty} /> : null}
      {announcements.data && announcements.data.length > 0 ? (
        <ListSurface>
          {announcements.data.map((a, i) => (
            <View key={a.id}>
              {i > 0 ? <Divider /> : null}
              <View
                style={{
                  flexDirection: "row",
                  gap: space.xs,
                  paddingLeft: space.lg,
                  paddingRight: space.xs,
                  paddingVertical: space.md,
                }}
              >
                <View style={{ flex: 1, gap: space.xs }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
                    <T variant="caption" tone="muted">
                      {[a.authorName, a.groupName, capitalize(formatDayMonth(a.createdAt.slice(0, 10)))]
                        .filter(Boolean)
                        .join(" · ")}
                    </T>
                    {a.pinned ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Pin size={14} color={scene.link} accessibilityElementsHidden importantForAccessibility="no" />
                        <Tag label={m.announcements.pinned} tone="brand" />
                      </View>
                    ) : null}
                  </View>
                  <T variant="body">{a.body}</T>
                </View>
                {canPublish ? null : (
                  <IconButton
                    icon={MoreHorizontal}
                    label={m.mobile.a11y.moreOnAnnouncement}
                    onPress={() => setReporting(a.id)}
                  />
                )}
              </View>
            </View>
          ))}
        </ListSurface>
      ) : null}
      {publishing ? <PublishSheet orgId={orgId} onClose={() => setPublishing(false)} /> : null}
      {reporting ? (
        <ModerationSheet
          orgId={orgId}
          target={{ entityType: "announcement", entityId: reporting }}
          onClose={() => setReporting(null)}
        />
      ) : null}
    </TabScreen>
  );
};
