import type { CalendarSession } from "@tartan/contracts";
import { publicationCandidates, publicationSelection } from "@tartan/domain";
import { formatDateLong, m } from "@tartan/i18n";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { Button, Card, SectionTitle, T } from "../ui/primitives";
import { space } from "../ui/theme";
const t = m.batchPublication;
export function NativeBatchPublication({
  orgId,
  sessions,
  refresh,
}: {
  orgId: string;
  sessions: CalendarSession[];
  refresh: () => Promise<unknown>;
}) {
  const client = useQueryClient(),
    router = useRouter();
  const [review, setReview] = useState<CalendarSession[] | null>(null),
    [selected, setSelected] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const publish = useMutation({
    mutationFn: () => api.publishSessions(orgId, publicationSelection(review ?? [], selected)),
    onSuccess: async () => {
      setReview(null);
      setSelected([]);
      setSuccess(true);
      await client.invalidateQueries({ queryKey: ["coach-calendar", orgId] });
      await client.invalidateQueries({ queryKey: ["tracking", orgId] });
    },
  });
  const candidates = publicationCandidates(sessions);
  if (!candidates.length && !review && !success) return null;
  return (
    <View style={{ gap: space.sm }}>
      {success ? <T accessibilityLiveRegion="polite">{t.success}</T> : null}
      {candidates.length ? (
        <Button
          label={t.open}
          variant="secondary"
          disabled={refreshing}
          expanded={review !== null}
          onPress={() => {
            if (publish.isPending) return;
            setReview(review ? null : candidates);
            setSelected([]);
            publish.reset();
            setSuccess(false);
          }}
        />
      ) : null}
      {review ? (
        <Card>
          <View style={{ gap: space.md }}>
            <SectionTitle>{t.title}</SectionTitle>
            <T>{t.hint}</T>
            <T tone="muted">{t.atomic}</T>
            <T accessibilityLiveRegion="polite">{t.selected(selected.length)}</T>
            {review.map((s) => (
              <View key={s.id} style={{ gap: space.xs }}>
                <Button
                  label={`${s.title} · ${formatDateLong(s.date)} · ${s.audience}${s.publishAt ? ` · ${t.scheduled}` : ""}`}
                  variant="secondary"
                  selected={selected.includes(s.id)}
                  disabled={publish.isPending || (selected.length >= 14 && !selected.includes(s.id))}
                  onPress={() =>
                    setSelected((ids) => (ids.includes(s.id) ? ids.filter((id) => id !== s.id) : [...ids, s.id]))
                  }
                />
                <Button
                  label={t.edit}
                  variant="secondary"
                  disabled={publish.isPending}
                  onPress={() => router.push(`/session-builder/${s.id}`)}
                />
              </View>
            ))}
            {publish.isError ? (
              <>
                <T accessibilityLiveRegion="assertive">{errorMessage(publish.error)}</T>
                <Button
                  label={t.refresh}
                  variant="secondary"
                  onPress={async () => {
                    setReview(null);
                    setSelected([]);
                    publish.reset();
                    setRefreshing(true);
                    try {
                      await refresh();
                    } finally {
                      setRefreshing(false);
                    }
                  }}
                />
              </>
            ) : null}
            <Button
              label={t.confirm(selected.length)}
              loading={publish.isPending}
              disabled={!selected.length}
              onPress={() => publish.mutate()}
            />
          </View>
        </Card>
      ) : null}
    </View>
  );
}
