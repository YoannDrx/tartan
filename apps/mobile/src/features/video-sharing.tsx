import type { VideoDetail } from "@tartan/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { m } from "@tartan/i18n";
import { useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { Button, Chip, SectionTitle, T } from "../ui/primitives";
import { space } from "../ui/theme";

export function VideoSharing({ orgId, video, staff }: { orgId: string; video: VideoDetail; staff: boolean }) {
  const client = useQueryClient();
  const router = useRouter();
  const [groups, setGroups] = useState(video.sharedGroupIds ?? []);
  const share = useMutation({
    mutationFn: ({ withAthlete, groupIds }: { withAthlete: boolean; groupIds?: string[] }) =>
      api.shareVideo(orgId, video.id, withAthlete, groupIds),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["videos", orgId] }),
  });
  const confirmGroups = () =>
    Alert.alert(m.videoCollaboration.shareGroups, m.videoCollaboration.shareNotice, [
      { text: m.common.cancel, style: "cancel" },
      { text: m.videoCollaboration.saveShare, onPress: () => share.mutate({ withAthlete: true, groupIds: groups }) },
    ]);
  const review = useMutation({
    mutationFn: () => api.reviewVideo(orgId, video.id),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["videos", orgId] }),
  });
  const remove = useMutation({
    mutationFn: () => api.deleteVideo(orgId, video.id),
    onSuccess: async () => {
      client.removeQueries({ queryKey: ["videos", orgId, video.id], exact: true });
      await client.invalidateQueries({ queryKey: ["videos", orgId] });
      router.back();
    },
  });
  return (
    <View style={{ gap: space.sm }}>
      {staff ? (
        <Button
          testID="video-reviewed"
          label={video.reviewedAt ? m.videoCollaboration.reviewed : m.videoCollaboration.review}
          variant="secondary"
          disabled={Boolean(video.reviewedAt) || !video.canAnnotate}
          loading={review.isPending}
          onPress={() => review.mutate()}
        />
      ) : null}
      {staff && video.canHideFromAthlete ? (
        <Button
          testID="video-share"
          label={video.sharedWithAthlete ? m.video.unshare : m.video.share}
          variant="secondary"
          loading={share.isPending}
          onPress={() => share.mutate({ withAthlete: !video.sharedWithAthlete })}
        />
      ) : null}
      {video.canShareGroups ? (
        <>
          <SectionTitle>{m.videoCollaboration.groups}</SectionTitle>
          <T variant="small" tone="muted">
            {m.videoCollaboration.shareNotice}
          </T>
          {(video.availableShareGroups ?? []).map((group) => (
            <Chip
              key={group.id}
              label={group.name}
              active={groups.includes(group.id)}
              onPress={() =>
                setGroups((selected) =>
                  selected.includes(group.id) ? selected.filter((id) => id !== group.id) : [...selected, group.id],
                )
              }
            />
          ))}
          <Button
            testID="video-share-groups"
            label={m.videoCollaboration.shareGroups}
            variant="secondary"
            disabled={groups.length === 0 || share.isPending}
            onPress={confirmGroups}
          />
          {(video.sharedGroupIds?.length ?? 0) > 0 ? (
            <Button
              testID="video-revoke-groups"
              label={m.videoCollaboration.revoke}
              variant="secondary"
              loading={share.isPending}
              onPress={() => {
                setGroups([]);
                share.mutate({ withAthlete: true, groupIds: [] });
              }}
            />
          ) : (
            <T variant="small" tone="muted">
              {m.videoCollaboration.private}
            </T>
          )}
        </>
      ) : null}
      {share.isError ? (
        <T tone="danger" accessibilityLiveRegion="polite">
          {errorMessage(share.error)}
        </T>
      ) : null}
      {share.isSuccess ? (
        <T variant="small" accessibilityLiveRegion="polite">
          {m.videoCollaboration.shareSaved}
        </T>
      ) : null}
      {video.canManage ? (
        <Button
          label={m.common.delete}
          variant="secondary"
          testID="video-delete"
          loading={remove.isPending}
          onPress={() =>
            Alert.alert(m.common.delete, m.videoCollaboration.deleteConfirm, [
              { text: m.common.cancel, style: "cancel" },
              { text: m.common.delete, style: "destructive", onPress: () => remove.mutate() },
            ])
          }
        />
      ) : null}
      {review.isError || remove.isError ? (
        <T tone="danger" accessibilityLiveRegion="polite">
          {errorMessage(review.error ?? remove.error)}
        </T>
      ) : null}
    </View>
  );
}
