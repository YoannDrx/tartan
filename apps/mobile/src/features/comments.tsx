import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CommentEntity } from "@tartan/contracts";
import { capitalize, formatDayMonth, m } from "@tartan/i18n";
import { useState } from "react";
import { Alert, View } from "react-native";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { useComments, useMe } from "../lib/queries";
import { ArrowUp, MoreHorizontal } from "../ui/icons";
import { Button, Field, IconButton, T } from "../ui/primitives";
import { Sheet } from "../ui/sheet";
import { ErrorState, LoadingState } from "../ui/states";
import { radius, space, usePalette } from "../ui/theme";

type ModerationTarget = {
  entityType: "comment" | "video" | "announcement";
  entityId: string;
  authorId?: string;
  authorName?: string | null;
};
type Reason = keyof typeof m.mobile.moderation.reasons;

// Signalement et blocage : exigés par Apple et Google dès qu'il y a du contenu d'utilisateurs.
export const ModerationSheet = ({
  orgId,
  target,
  dark,
  onClose,
}: {
  orgId: string;
  target: ModerationTarget;
  dark?: boolean;
  onClose: () => void;
}) => {
  const [step, setStep] = useState<"menu" | "reason" | "done">("menu");
  const [message, setMessage] = useState<string | null>(null);
  const report = useMutation({
    mutationFn: (reason: Reason) =>
      api.report(orgId, { entityType: target.entityType, entityId: target.entityId, reason }),
    onSuccess: () => {
      setMessage(m.comments.reported);
      setStep("done");
    },
  });
  const block = useMutation({
    mutationFn: () => api.block(target.authorId as string),
    onSuccess: () => {
      setMessage(m.mobile.moderation.blocked);
      setStep("done");
    },
  });
  const name = target.authorName ?? m.mobile.moderation.someone;
  return (
    <Sheet
      visible
      dark={dark}
      onClose={onClose}
      title={step === "reason" ? m.mobile.moderation.reportTitle : m.mobile.moderation.title}
    >
      {step === "menu" ? (
        <View style={{ gap: space.sm }}>
          <Button label={m.comments.report} variant="secondary" onPress={() => setStep("reason")} />
          {target.authorId ? (
            <Button
              label={m.comments.block}
              variant="danger"
              loading={block.isPending}
              onPress={() =>
                Alert.alert(m.comments.block, m.mobile.moderation.blockConfirm(name), [
                  { text: m.common.cancel, style: "cancel" },
                  { text: m.comments.block, style: "destructive", onPress: () => block.mutate() },
                ])
              }
            />
          ) : null}
        </View>
      ) : null}
      {step === "reason" ? (
        <View style={{ gap: space.sm }}>
          {(Object.keys(m.mobile.moderation.reasons) as Reason[]).map((reason) => (
            <Button
              key={reason}
              label={m.mobile.moderation.reasons[reason]}
              variant="secondary"
              disabled={report.isPending}
              onPress={() => report.mutate(reason)}
            />
          ))}
        </View>
      ) : null}
      {step === "done" ? (
        <View style={{ gap: space.md }}>
          <T accessibilityLiveRegion="polite">{message}</T>
          <Button label={m.common.close} variant="secondary" onPress={onClose} />
        </View>
      ) : null}
      {report.isError || block.isError ? (
        <T tone="danger" variant="caption">
          {errorMessage(report.error ?? block.error)}
        </T>
      ) : null}
    </Sheet>
  );
};

export const CommentsSection = ({
  orgId,
  entityType,
  entityId,
  dark,
  placeholder = m.comments.placeholder,
}: {
  orgId: string;
  entityType: CommentEntity;
  entityId: string;
  dark?: boolean;
  placeholder?: string;
}) => {
  const p = usePalette();
  const me = useMe();
  const client = useQueryClient();
  const comments = useComments(orgId, entityType, entityId);
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<ModerationTarget | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: (text: string) => api.addComment(orgId, { entityType, entityId, body: text }),
    onSuccess: () => {
      setBody("");
      void client.invalidateQueries({ queryKey: ["comments", orgId, entityType, entityId] });
    },
    onError: () => setFormError(m.mobile.comments.failed),
  });
  const send = () => {
    const text = body.trim();
    if (!text) {
      setFormError(m.mobile.comments.empty);
      return;
    }
    setFormError(null);
    add.mutate(text);
  };
  return (
    <View style={{ gap: space.md }}>
      {comments.isPending ? <LoadingState inline /> : null}
      {comments.isError ? <ErrorState error={comments.error} onRetry={() => void comments.refetch()} /> : null}
      {comments.data?.length === 0 ? (
        <T variant="small" tone="muted">
          {m.comments.empty}
        </T>
      ) : null}
      {comments.data?.map((c) => (
        <View
          key={c.id}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: space.xs,
            backgroundColor: p.surface,
            borderRadius: radius.card,
            borderWidth: p.dark ? 0 : 1,
            borderColor: p.border,
            paddingLeft: space.md,
            paddingVertical: space.sm,
          }}
        >
          <View style={{ flex: 1, gap: 2, paddingVertical: space.xs }}>
            <T variant="caption" tone="muted">
              {[c.authorName ?? m.mobile.comments.author, capitalize(formatDayMonth(c.createdAt.slice(0, 10)))].join(
                " · ",
              )}
            </T>
            <T variant="small">{c.body}</T>
          </View>
          {c.authorId !== me.data?.id ? (
            <IconButton
              icon={MoreHorizontal}
              label={m.mobile.a11y.moreOnComment}
              onPress={() =>
                setTarget({ entityType: "comment", entityId: c.id, authorId: c.authorId, authorName: c.authorName })
              }
            />
          ) : null}
        </View>
      ))}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm }}>
        <Field
          label={m.comments.title}
          hideLabel
          value={body}
          onChangeText={setBody}
          placeholder={placeholder}
          multiline
          maxLength={2000}
          containerStyle={{ flex: 1 }}
          style={{ minHeight: 44, paddingTop: space.sm }}
          error={formError}
        />
        <IconButton icon={ArrowUp} label={m.common.send} tone="accent" onPress={send} disabled={add.isPending} />
      </View>
      {target ? <ModerationSheet orgId={orgId} target={target} dark={dark} onClose={() => setTarget(null)} /> : null}
    </View>
  );
};
