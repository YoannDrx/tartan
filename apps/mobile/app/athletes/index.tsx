import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useActiveSpace, useAthletes } from "../../src/lib/queries";
import { ChevronRight, UserPlus } from "../../src/ui/icons";
import { Button, Divider, Field, ListSurface, T } from "../../src/ui/primitives";
import { StackScreen } from "../../src/ui/screen";
import { EmptyState, ErrorState, LoadingState } from "../../src/ui/states";
import { palettes, space } from "../../src/ui/theme";

const folded = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Athletes() {
  const { orgId, space: active } = useActiveSpace();
  const athletes = useAthletes(orgId);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const canInvite = active?.role === "owner" || active?.role === "coach";
  const list = useMemo(() => {
    const query = folded(search.trim());
    return (athletes.data ?? []).filter((a) => !query || folded(`${a.firstName} ${a.lastName}`).includes(query));
  }, [athletes.data, search]);

  return (
    <StackScreen
      world="work"
      title={m.athletes.title}
      footer={
        canInvite ? (
          <Button
            testID="athletes-invite"
            label={m.mobile.invitePage.open}
            icon={UserPlus}
            onPress={() => router.push("/invite")}
          />
        ) : undefined
      }
    >
      {athletes.isPending ? <LoadingState /> : null}
      {athletes.isError && !athletes.data ? (
        <ErrorState error={athletes.error} onRetry={() => void athletes.refetch()} />
      ) : null}
      {athletes.data?.length === 0 ? <EmptyState body={m.athletes.empty} /> : null}
      {athletes.data && athletes.data.length > 0 ? (
        <Field
          label={m.mobile.athletePage.search}
          hideLabel
          placeholder={m.mobile.athletePage.search}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
      ) : null}
      {athletes.data && athletes.data.length > 0 && list.length === 0 ? <T>{m.mobile.athletePage.noResult}</T> : null}
      {list.length > 0 ? (
        <ListSurface>
          {list.map((a, i) => {
            const name = `${a.firstName} ${a.lastName}`.trim();
            const detail = [
              a.level,
              a.groups.map((g) => g.name).join(", "),
              a.hasAccount ? null : m.mobile.athletePage.noAccount,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <View key={a.id}>
                {i > 0 ? <Divider /> : null}
                <Pressable
                  testID={`athlete-${a.id}`}
                  onPress={() => router.push(`/athletes/${a.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={[name, detail].filter(Boolean).join(", ")}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space.md,
                    padding: space.md,
                    minHeight: 60,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <T variant="smallStrong">{name}</T>
                    {detail ? (
                      <T variant="caption" tone="muted">
                        {detail}
                      </T>
                    ) : null}
                  </View>
                  <ChevronRight
                    size={18}
                    color={palettes.work.textMuted}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                </Pressable>
              </View>
            );
          })}
        </ListSurface>
      ) : null}
    </StackScreen>
  );
}
