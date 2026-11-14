import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, monthRange, shiftMonthKey } from "@tartan/domain";
import { useEffect } from "react";
import { api, fetchCoachAthleteFile } from "./api";
import { localIsoDate } from "./dates";
import { pickSpace, useSpaceStore } from "./space-store";
import { athleteFile, athleteStats, coachAthleteFile, coachSessionDetail } from "./schemas";
import { queryClient, WEEK_MS } from "./query-client";
import { useSession } from "./session-store";
import { prefetchSessionIllustrations } from "./exercise-guide-media";

export const useMe = (enabled = true) => {
  const signedIn = useSession((s) => s.status === "signed-in");
  return useQuery({ queryKey: ["me"], queryFn: api.me, enabled: enabled && signedIn });
};

export const useActiveSpace = () => {
  const me = useMe();
  const activeOrgId = useSpaceStore((s) => s.activeOrgId);
  const space = me.data ? pickSpace(me.data.spaces, activeOrgId) : null;
  return { me, space, orgId: space?.organizationId ?? "" };
};

export const useToday = (orgId: string) =>
  useQuery({ queryKey: ["today", orgId], queryFn: () => api.today(orgId), enabled: Boolean(orgId) });

export const useSessionDetail = (orgId: string, sessionId: string | null | undefined) => {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["session", orgId, sessionId],
    queryFn: () => api.session(orgId, sessionId as string),
    enabled: Boolean(orgId && sessionId),
  });
  useEffect(() => {
    if (query.data) void prefetchSessionIllustrations(client, query.data);
  }, [client, query.data]);
  return query;
};

export const useAthleteCalendar = (orgId: string, from: string, to: string) =>
  useQuery({
    queryKey: ["athlete-calendar", orgId, from, to],
    queryFn: () => api.athleteCalendar(orgId, from, to),
    enabled: Boolean(orgId),
    placeholderData: keepPreviousData,
  });

export const useCoachCalendar = (orgId: string, from: string, to: string, groupId?: string, summary = false) =>
  useQuery({
    queryKey: ["coach-calendar", orgId, from, to, groupId ?? "all", summary],
    queryFn: () => api.calendar(orgId, from, to, groupId, summary),
    enabled: Boolean(orgId),
    placeholderData: keepPreviousData,
  });

// Les mois voisins arrivent d'avance : changer de mois reste immédiat, y compris au stade.
export const usePrefetchMonths = (orgId: string, month: string, enabled: boolean, groupId?: string, coach = false) => {
  const client = useQueryClient();
  useEffect(() => {
    if (!enabled || !orgId) return;
    for (const delta of [-1, 1]) {
      const { from, to } = monthRange(shiftMonthKey(month, delta));
      if (coach) {
        void client.prefetchQuery({
          queryKey: ["coach-calendar", orgId, from, to, groupId ?? "all", true],
          queryFn: () => api.calendar(orgId, from, to, groupId, true),
        });
      } else {
        void client.prefetchQuery({
          queryKey: ["athlete-calendar", orgId, from, to],
          queryFn: () => api.athleteCalendar(orgId, from, to),
        });
      }
    }
  }, [client, coach, enabled, groupId, month, orgId]);
};

export const useAnnouncements = (orgId: string) =>
  useQuery({ queryKey: ["announcements", orgId], queryFn: () => api.announcements(orgId), enabled: Boolean(orgId) });

export const useTracking = (orgId: string, week: string, groupId?: string) =>
  useQuery({
    queryKey: ["tracking", orgId, week, groupId ?? "all"],
    queryFn: () => api.tracking(orgId, { week, groupId }),
    enabled: Boolean(orgId),
  });

export const useAlerts = (orgId: string) =>
  useQuery({ queryKey: ["alerts", orgId], queryFn: () => api.alerts(orgId), enabled: Boolean(orgId) });

export const useGroups = (orgId: string) =>
  useQuery({ queryKey: ["groups", orgId], queryFn: () => api.groups(orgId), enabled: Boolean(orgId) });

export const useAthletes = (orgId: string, enabled = true) =>
  useQuery({ queryKey: ["athletes", orgId], queryFn: () => api.athletes(orgId), enabled: Boolean(orgId) && enabled });

export const useExercises = (orgId: string) =>
  useQuery({ queryKey: ["exercises", orgId], queryFn: () => api.exercises(orgId), enabled: Boolean(orgId) });

export const useVideos = (orgId: string) =>
  useQuery({
    queryKey: ["videos", orgId],
    queryFn: () => api.videos(orgId),
    enabled: Boolean(orgId),
    // Mux finit l'encodage après l'envoi : la liste se met à jour tant qu'une vidéo est en chemin.
    refetchInterval: (query) =>
      query.state.data?.some((video) => video.status === "uploading" || video.status === "processing") ? 15_000 : false,
  });

export const useExerciseVideos = (orgId: string, exerciseId: string) =>
  useQuery({
    queryKey: ["videos", orgId, "exercise", exerciseId],
    queryFn: () => api.videos(orgId, undefined, exerciseId),
    enabled: Boolean(orgId),
  });

export const useVideo = (orgId: string, videoId: string | undefined) =>
  useQuery({
    queryKey: ["videos", orgId, videoId],
    queryFn: () => api.video(orgId, videoId as string),
    enabled: Boolean(orgId && videoId),
  });

export const useCoachSession = (orgId: string, sessionId: string | undefined) =>
  useQuery({
    queryKey: ["coach-session", orgId, sessionId],
    queryFn: async () => coachSessionDetail.parse(await api.coachSession(orgId, sessionId as string)),
    enabled: Boolean(orgId && sessionId),
  });

export const useAthleteFile = (orgId: string) =>
  useQuery({
    queryKey: ["athlete-file", orgId],
    queryFn: async () => athleteFile.parse(await api.athleteFile(orgId)),
    enabled: Boolean(orgId),
  });

// Données de santé d'autres personnes : ces requêtes restent en mémoire (voir PERSISTED).
export const useAthleteStats = (orgId: string, athleteId: string | undefined) =>
  useQuery({
    queryKey: ["athlete-stats", orgId, athleteId],
    queryFn: async () => athleteStats.parse(await api.athleteStats(orgId, athleteId as string)),
    enabled: Boolean(orgId && athleteId),
  });

export const useCoachAthleteFile = (orgId: string, athleteId: string | undefined) =>
  useQuery({
    queryKey: ["coach-athlete", orgId, athleteId],
    queryFn: async () => coachAthleteFile.parse(await fetchCoachAthleteFile(orgId, athleteId as string)),
    enabled: Boolean(orgId && athleteId),
  });

export const useBarSheet = (orgId: string, athleteId: string | undefined) =>
  useQuery({
    queryKey: ["bar-sheet", orgId, athleteId],
    queryFn: () => api.barSheet(orgId, athleteId as string),
    enabled: Boolean(orgId && athleteId),
  });

export const useAthleteVideos = (orgId: string, athleteId: string | undefined) =>
  useQuery({
    queryKey: ["videos", orgId, "athlete", athleteId],
    queryFn: () => api.videos(orgId, athleteId),
    enabled: Boolean(orgId && athleteId),
  });

export const useGroupLink = (orgId: string, groupId: string | undefined) =>
  useQuery({
    queryKey: ["group-link", orgId, groupId],
    queryFn: () => api.groupLink(orgId, groupId as string),
    enabled: Boolean(orgId && groupId),
    staleTime: 5 * 60 * 1000,
  });

export const useComments = (orgId: string, entityType: "session" | "log" | "video", entityId: string) =>
  useQuery({
    queryKey: ["comments", orgId, entityType, entityId],
    queryFn: () => api.comments(orgId, entityType, entityId),
    enabled: Boolean(orgId && entityId),
  });

// Séances des 7 prochains jours gardées sur le téléphone (§ 10.4).
export const usePrefetchUpcomingSessions = (orgId: string) => {
  const enabled = Boolean(orgId);
  useEffect(() => {
    if (!enabled) return;
    const from = localIsoDate();
    const to = addDays(from, 7);
    let cancelled = false;
    void (async () => {
      const calendar = await queryClient
        .fetchQuery({
          queryKey: ["athlete-calendar", orgId, from, to],
          queryFn: () => api.athleteCalendar(orgId, from, to),
          staleTime: 5 * 60 * 1000,
        })
        .catch(() => null);
      if (!calendar || cancelled) return;
      await Promise.all(
        calendar.sessions.map((s) =>
          queryClient
            .fetchQuery({
              queryKey: ["session", orgId, s.id],
              queryFn: () => api.session(orgId, s.id),
              staleTime: 5 * 60 * 1000,
              gcTime: WEEK_MS,
            })
            .then((session) => (cancelled ? undefined : prefetchSessionIllustrations(queryClient, session)))
            .catch(() => undefined),
        ),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, orgId]);
};
