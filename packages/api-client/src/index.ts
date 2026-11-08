import { publishSessionsResult, type PublishSessionsInput } from "@tartan/contracts";
import {
  plannerTranscriptionResponse,
  plannerLoadsPreview,
  type PreviewPlannerLoadsInput,
  plannerProposalResponse,
  plannerProposalList,
  type PlannerProposalListQuery,
  plannerDraftsResponse,
  plannerConfirmationResult,
  plannerUsageResponse,
  type CreatePlannerProposalInput,
  type ClarifyPlannerProposalInput,
  type ConfirmPlannerProposalInput,
  trainingAnalysisContext,
  trainingAnalysisResponse,
  type TrainingAnalysisQuery,
  trainingPhaseList,
  phasePlanningResponse,
  type PhasePlanningQuery,
  trainingPhaseContext,
  trainingPhaseWriteResult,
  type TrainingPhaseQuery,
  type SaveTrainingPhaseInput,
  performanceWriteResult,
  type PerformanceInput,
  type UpdatePerformanceInput,
  acceptInvitationResponse,
  athleteExerciseIndex,
  athleteHistoryContext,
  exerciseHistoryResponse,
  type ExerciseHistoryQuery,
  organizationResponse,
  type OrganizationUpdateInput,
  type CreateOrganizationInput,
  type AcceptInvitationInput,
  type AnnotationInput,
  announcementItem,
  type AnnouncementInput,
  athleteSessionDetail,
  athleteToday,
  calendarResponse,
  commentItem,
  type CommentEntity,
  type CommentInput,
  type CreateInvitationInput,
  type CreateVideoInput,
  createVideoResponse,
  coachAlert,
  exerciseSummary,
  invitationPreview,
  type JumpAttemptInput,
  meResponse,
  type PreferencesInput,
  ProfileInput,
  type RollCallInput,
  type SessionLogInput,
  sessionLogResult,
  sessionSaveResult,
  prescriptionRefreshPreview,
  type ConfirmPrescriptionRefresh,
  sessionEditResponse,
  sessionBuilderContext,
  type SaveScheduledSessionInput,
  type DeleteSessionInput,
  type SessionDraft,
  strengthReferenceResponse,
  strengthMappingReportResponse,
  type LegacyStrengthMappingInput,
  type ChooseStrengthReference,
  type StrengthTestInput,
  trackingGrid,
  videoDetail,
  videoSummary,
} from "@tartan/contracts";
import { z } from "zod";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  // Le mobile fournit le cookie de session Better Auth stocké dans le trousseau.
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  fetch?: typeof fetch;
};

const okResponse = z.object({ ok: z.literal(true) });

export const createApiClient = (options: ApiClientOptions) => {
  const doFetch = options.fetch ?? fetch;

  const request = async <T>(
    method: string,
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
    query?: Record<string, string | undefined>,
    signal?: AbortSignal,
  ): Promise<T> => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) if (value) params.set(key, value);
    const suffix = params.size ? `?${params.toString()}` : "";
    const multipart = typeof FormData !== "undefined" && body instanceof FormData;
    const res = await doFetch(`${options.baseUrl}/api/v1${path}${suffix}`, {
      method,
      signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined && !multipart ? { "Content-Type": "application/json" } : {}),
        ...(await options.headers?.()),
      },
      body: multipart ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const error = json as { message?: string; code?: string } | null;
      throw new ApiError(res.status, error?.code, error?.message ?? "Erreur réseau");
    }
    return schema.parse(json);
  };

  return {
    transcribePlannerAudio: (orgId: string, body: FormData, signal?: AbortSignal) =>
      request("POST", `/orgs/${orgId}/planner/transcriptions`, plannerTranscriptionResponse, body, undefined, signal),
    plannerTranscription: (orgId: string, transcriptionId: string, signal?: AbortSignal) =>
      request(
        "GET",
        `/orgs/${orgId}/planner/transcriptions/${transcriptionId}`,
        plannerTranscriptionResponse,
        undefined,
        undefined,
        signal,
      ),
    plannerUsage: (orgId: string, signal?: AbortSignal) =>
      request("GET", `/orgs/${orgId}/planner/usage`, plannerUsageResponse, undefined, undefined, signal),
    plannerProposals: (orgId: string, query: PlannerProposalListQuery = {}, signal?: AbortSignal) =>
      request("GET", `/orgs/${orgId}/planner/proposals`, plannerProposalList, undefined, query, signal),
    createPlannerProposal: (orgId: string, body: CreatePlannerProposalInput, signal?: AbortSignal) =>
      request("POST", `/orgs/${orgId}/planner`, plannerProposalResponse, body, undefined, signal),
    plannerProposal: (orgId: string, proposalId: string, signal?: AbortSignal) =>
      request(
        "GET",
        `/orgs/${orgId}/planner/proposals/${proposalId}`,
        plannerProposalResponse,
        undefined,
        undefined,
        signal,
      ),
    clarifyPlannerProposal: (
      orgId: string,
      proposalId: string,
      body: ClarifyPlannerProposalInput,
      signal?: AbortSignal,
    ) =>
      request(
        "POST",
        `/orgs/${orgId}/planner/proposals/${proposalId}/clarify`,
        plannerProposalResponse,
        body,
        undefined,
        signal,
      ),
    preparePlannerDrafts: (orgId: string, proposalId: string, expectedVersion: number, signal?: AbortSignal) =>
      request(
        "POST",
        `/orgs/${orgId}/planner/proposals/${proposalId}/prepare`,
        plannerDraftsResponse,
        {
          expectedVersion,
        },
        undefined,
        signal,
      ),
    confirmPlannerProposal: (
      orgId: string,
      proposalId: string,
      body: ConfirmPlannerProposalInput,
      signal?: AbortSignal,
    ) =>
      request(
        "POST",
        `/orgs/${orgId}/planner/proposals/${proposalId}/confirm`,
        plannerConfirmationResult,
        body,
        undefined,
        signal,
      ),
    previewPlannerLoads: (orgId: string, proposalId: string, body: PreviewPlannerLoadsInput, signal?: AbortSignal) =>
      request(
        "POST",
        `/orgs/${orgId}/planner/proposals/${proposalId}/preview`,
        plannerLoadsPreview,
        body,
        undefined,
        signal,
      ),
    phasePlanning: (orgId: string, query: PhasePlanningQuery) =>
      request("POST", `/orgs/${orgId}/phases/planning`, phasePlanningResponse, query),
    trainingPhases: (orgId: string, query: TrainingPhaseQuery) =>
      request("GET", `/orgs/${orgId}/phases`, trainingPhaseList, undefined, query),
    trainingPhaseContext: (orgId: string) => request("GET", `/orgs/${orgId}/phases/context`, trainingPhaseContext),
    saveTrainingPhase: (orgId: string, body: SaveTrainingPhaseInput) =>
      request("POST", `/orgs/${orgId}/phases`, trainingPhaseWriteResult, body),
    setTrainingPhaseVisibility: (orgId: string, phaseId: string, expectedVersion: number, shared: boolean) =>
      request("PUT", `/orgs/${orgId}/phases/${phaseId}/visibility`, trainingPhaseWriteResult, {
        expectedVersion,
        shared,
      }),
    deleteTrainingPhase: (orgId: string, phaseId: string, expectedVersion: number) =>
      request("DELETE", `/orgs/${orgId}/phases/${phaseId}`, trainingPhaseWriteResult, undefined, {
        expectedVersion: String(expectedVersion),
      }),
    me: () => request("GET", "/me", meResponse),
    exportMyData: () => request("GET", "/me/export", z.any()),
    billing: (orgId: string) => request("GET", `/orgs/${orgId}/billing`, z.any()),
    trainingAnalysisContext: (orgId: string) =>
      request("GET", `/orgs/${orgId}/analysis/context`, trainingAnalysisContext),
    trainingAnalysis: (orgId: string, query: TrainingAnalysisQuery) =>
      request(
        "GET",
        `/orgs/${orgId}/analysis?${new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === "string"))}`,
        trainingAnalysisResponse,
      ),
    athleteStats: (orgId: string, athleteId: string) =>
      request("GET", `/orgs/${orgId}/athletes/${athleteId}/stats`, z.any()),
    athleteHistoryExercises: (orgId: string, athleteId: string) =>
      request("GET", `/orgs/${orgId}/athletes/${athleteId}/exercise-history`, athleteExerciseIndex),
    athleteHistoryContext: (orgId: string, athleteId: string) =>
      request("GET", `/orgs/${orgId}/athletes/${athleteId}/exercise-history/context`, athleteHistoryContext),
    athleteExerciseHistory: (orgId: string, athleteId: string, exerciseId: string, query: ExerciseHistoryQuery) =>
      request(
        "GET",
        `/orgs/${orgId}/athletes/${athleteId}/exercise-history/${exerciseId}`,
        exerciseHistoryResponse,
        undefined,
        query,
      ),
    strengthMappings: (orgId: string) =>
      request("GET", `/orgs/${orgId}/strength-mappings`, strengthMappingReportResponse),
    confirmStrengthMapping: (orgId: string, body: LegacyStrengthMappingInput) =>
      request("POST", `/orgs/${orgId}/strength-mappings`, strengthMappingReportResponse, body),
    exerciseStrength: (orgId: string, athleteId: string, exerciseId: string) =>
      request("GET", `/orgs/${orgId}/athletes/${athleteId}/strength/${exerciseId}`, strengthReferenceResponse),
    selectStrengthReference: (orgId: string, athleteId: string, exerciseId: string, body: ChooseStrengthReference) =>
      request("PUT", `/orgs/${orgId}/athletes/${athleteId}/strength/${exerciseId}`, strengthReferenceResponse, body),
    addPerformance: (
      orgId: string,
      athleteId: string,
      body: Omit<PerformanceInput, "athleteId"> & { clientId: string },
    ) => request("POST", `/orgs/${orgId}/athletes/${athleteId}/performances`, performanceWriteResult, body),
    updatePerformance: (
      orgId: string,
      athleteId: string,
      performanceId: string,
      body: Omit<UpdatePerformanceInput, "id" | "athleteId">,
    ) =>
      request(
        "PUT",
        `/orgs/${orgId}/athletes/${athleteId}/performances/${performanceId}`,
        performanceWriteResult,
        body,
      ),
    deletePerformance: (orgId: string, athleteId: string, performanceId: string, expectedVersion: number) =>
      request(
        "DELETE",
        `/orgs/${orgId}/athletes/${athleteId}/performances/${performanceId}`,
        z.object({ athleteId: z.string() }),
        undefined,
        { expectedVersion: String(expectedVersion) },
      ),
    addStrengthTest: (orgId: string, athleteId: string, body: Omit<StrengthTestInput, "athleteId">) =>
      request("POST", `/orgs/${orgId}/athletes/${athleteId}/strength-tests`, z.object({ id: z.string() }), body),
    updateProfile: (body: ProfileInput) => request("PATCH", "/me", meResponse, body),
    updatePreferences: (body: PreferencesInput) => request("PATCH", "/me/preferences", meResponse, body),
    deleteAccount: () => request("DELETE", "/me", okResponse),
    unregisterDevice: (pushToken: string) => request("DELETE", "/devices", okResponse, { pushToken }),
    registerDevice: (pushToken: string, platform: "ios" | "android" | "web") =>
      request("POST", "/devices", okResponse, { pushToken, platform }),
    confirmAge: (birthDate: string) => request("POST", "/me/age", z.unknown(), { birthDate }),
    consents: () =>
      request("GET", "/consents", z.object({ health: z.boolean(), video: z.boolean(), terms: z.boolean() })),
    setConsent: (kind: "health" | "video" | "terms", granted: boolean) =>
      request("PUT", "/consents", z.object({ health: z.boolean(), video: z.boolean(), terms: z.boolean() }), {
        kind,
        granted,
      }),
    invitation: (token: string) => request("GET", `/invitations/${token}`, invitationPreview),
    acceptInvitation: (token: string, body: AcceptInvitationInput) =>
      request("POST", `/invitations/${token}/accept`, acceptInvitationResponse, body),
    organization: (orgId: string) => request("GET", `/orgs/${orgId}`, organizationResponse),
    updateOrganization: (orgId: string, body: OrganizationUpdateInput) =>
      request("PATCH", `/orgs/${orgId}`, organizationResponse, body),
    createOrganization: (body: CreateOrganizationInput) =>
      request("POST", "/orgs", z.object({ organizationId: z.string(), firstGroupId: z.string() }), body),
    today: (orgId: string) => request("GET", `/orgs/${orgId}/athlete/today`, athleteToday),
    athleteCalendar: (orgId: string, from: string, to: string) =>
      request(
        "GET",
        `/orgs/${orgId}/athlete/calendar`,
        z.object({
          sessions: z.array(athleteSessionDetail.omit({ blocks: true, log: true })),
          competitions: z.array(
            z.object({ id: z.string(), name: z.string(), date: z.string(), location: z.string().nullable() }),
          ),
        }),
        undefined,
        { from, to },
      ),
    athleteFile: (orgId: string) => request("GET", `/orgs/${orgId}/athlete/file`, z.any()),
    session: (orgId: string, sessionId: string) =>
      request("GET", `/orgs/${orgId}/sessions/${sessionId}/me`, athleteSessionDetail),
    logSession: (orgId: string, sessionId: string, body: SessionLogInput) =>
      request("POST", `/orgs/${orgId}/sessions/${sessionId}/log`, sessionLogResult, body),
    athleteSessionForCoach: (orgId: string, sessionId: string, athleteId: string) =>
      request("GET", `/orgs/${orgId}/sessions/${sessionId}/athletes/${athleteId}/log`, athleteSessionDetail),
    logSessionForAthlete: (orgId: string, sessionId: string, athleteId: string, body: SessionLogInput) =>
      request("POST", `/orgs/${orgId}/sessions/${sessionId}/athletes/${athleteId}/log`, sessionLogResult, body),
    setAttendance: (orgId: string, sessionId: string, status: "present" | "absent") =>
      request(
        "POST",
        `/orgs/${orgId}/sessions/${sessionId}/attendance`,
        z.object({ variant: z.string(), hasAutonomous: z.boolean() }),
        { status },
      ),
    tracking: (orgId: string, query: { week?: string; groupId?: string } = {}) =>
      request("GET", `/orgs/${orgId}/tracking`, trackingGrid, undefined, query),
    alerts: (orgId: string) => request("GET", `/orgs/${orgId}/alerts`, z.array(coachAlert)),
    coachSession: (orgId: string, sessionId: string) =>
      request("GET", `/orgs/${orgId}/sessions/${sessionId}/coach`, z.any()),
    sessionBuilder: (orgId: string) => request("GET", `/orgs/${orgId}/session-builder`, sessionBuilderContext),
    saveSessionTemplate: (orgId: string, body: SessionDraft) =>
      request("POST", `/orgs/${orgId}/session-templates`, z.object({ id: z.uuid() }), body),
    editSession: (orgId: string, sessionId: string) =>
      request("GET", `/orgs/${orgId}/sessions/${sessionId}`, sessionEditResponse),
    createSession: (orgId: string, body: Omit<SaveScheduledSessionInput, "id" | "expectedVersion">) =>
      request("POST", `/orgs/${orgId}/sessions`, sessionSaveResult, body),
    updateSession: (
      orgId: string,
      sessionId: string,
      body: Omit<SaveScheduledSessionInput, "id"> & { expectedVersion: number },
    ) => request("PUT", `/orgs/${orgId}/sessions/${sessionId}`, sessionSaveResult, body),
    publishSessions: (orgId: string, body: PublishSessionsInput) =>
      request("POST", `/orgs/${orgId}/sessions/publish-batch`, publishSessionsResult, body),
    publishSession: (orgId: string, sessionId: string, expectedVersion: number) =>
      request("POST", `/orgs/${orgId}/sessions/${sessionId}/publish`, z.object({ id: z.string() }), {
        expectedVersion,
      }),
    previewPrescriptionRefresh: (orgId: string, sessionId: string) =>
      request("GET", `/orgs/${orgId}/sessions/${sessionId}/refresh-loads`, prescriptionRefreshPreview),
    refreshPublishedLoads: (orgId: string, sessionId: string, body: ConfirmPrescriptionRefresh) =>
      request("POST", `/orgs/${orgId}/sessions/${sessionId}/refresh-loads`, sessionSaveResult, body),
    deleteSession: (orgId: string, sessionId: string, confirmation: DeleteSessionInput) =>
      request("DELETE", `/orgs/${orgId}/sessions/${sessionId}`, okResponse, undefined, {
        expectedVersion: String(confirmation.expectedVersion),
        expectedLogCount: String(confirmation.expectedLogCount),
      }),
    deleteSessionTemplate: (orgId: string, templateId: string) =>
      request("DELETE", `/orgs/${orgId}/session-templates/${templateId}`, okResponse),
    rollCall: (orgId: string, sessionId: string, body: RollCallInput) =>
      request(
        "POST",
        `/orgs/${orgId}/sessions/${sessionId}/roll-call`,
        z.object({ absentCount: z.number(), hasAutonomous: z.boolean() }),
        body,
      ),
    remind: (orgId: string, sessionId: string, athleteIds?: string[]) =>
      request("POST", `/orgs/${orgId}/sessions/${sessionId}/remind`, z.object({ count: z.number() }), { athleteIds }),
    generateAutonomous: (orgId: string, sessionId: string) =>
      request("POST", `/orgs/${orgId}/sessions/${sessionId}/autonomous`, okResponse),
    calendar: (orgId: string, from: string, to: string, groupId?: string, summary?: boolean) =>
      request("GET", `/orgs/${orgId}/calendar`, calendarResponse, undefined, {
        from,
        to,
        groupId,
        summary: summary ? "true" : undefined,
      }),
    exercises: (orgId: string) => request("GET", `/orgs/${orgId}/exercises`, z.array(exerciseSummary)),
    athletes: (orgId: string) =>
      request(
        "GET",
        `/orgs/${orgId}/athletes`,
        z.array(
          z.object({
            id: z.string(),
            firstName: z.string(),
            lastName: z.string(),
            hasAccount: z.boolean(),
            level: z.string().nullable(),
            groups: z.array(z.object({ id: z.string(), name: z.string() })),
          }),
        ),
      ),
    groups: (orgId: string) =>
      request(
        "GET",
        `/orgs/${orgId}/groups`,
        z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            color: z.string().nullable(),
            level: z.string().nullable(),
            goal: z.string().nullable(),
            athleteCount: z.number(),
          }),
        ),
      ),
    groupLink: (orgId: string, groupId: string) =>
      request("POST", `/orgs/${orgId}/groups/${groupId}/link`, z.object({ id: z.string(), link: z.string() })),
    createInvitation: (orgId: string, body: CreateInvitationInput) =>
      request("POST", `/orgs/${orgId}/invitations`, z.object({ id: z.string(), link: z.string() }), body),
    videos: (orgId: string, athleteId?: string) =>
      request("GET", `/orgs/${orgId}/videos`, z.array(videoSummary), undefined, { athleteId }),
    video: (orgId: string, videoId: string) => request("GET", `/orgs/${orgId}/videos/${videoId}`, videoDetail),
    createVideo: (orgId: string, body: CreateVideoInput) =>
      request("POST", `/orgs/${orgId}/videos`, createVideoResponse, body),
    renewVideoUpload: (orgId: string, videoId: string) =>
      request("POST", `/orgs/${orgId}/videos/${videoId}/upload`, createVideoResponse),
    deleteAnnotation: (orgId: string, videoId: string, annotationId: string) =>
      request("DELETE", `/orgs/${orgId}/videos/${videoId}/annotations/${annotationId}`, okResponse),
    addAnnotation: (orgId: string, videoId: string, body: AnnotationInput) =>
      request("POST", `/orgs/${orgId}/videos/${videoId}/annotations`, z.object({ id: z.string() }), body),
    shareVideo: (orgId: string, videoId: string, withAthlete: boolean) =>
      request("POST", `/orgs/${orgId}/videos/${videoId}/share`, okResponse, { withAthlete }),
    addJumpAttempt: (orgId: string, body: JumpAttemptInput) =>
      request("POST", `/orgs/${orgId}/jump-attempts`, z.object({ id: z.string() }), body),
    barSheet: (orgId: string, athleteId: string, scheduledSessionId?: string) =>
      request(
        "GET",
        `/orgs/${orgId}/bar-sheet`,
        z.object({
          rows: z.array(
            z.object({ heightCm: z.number(), label: z.string(), notation: z.string(), cleared: z.boolean() }),
          ),
          date: z.string().nullable(),
        }),
        undefined,
        { athleteId, scheduledSessionId },
      ),
    announcements: (orgId: string) => request("GET", `/orgs/${orgId}/announcements`, z.array(announcementItem)),
    publishAnnouncement: (orgId: string, body: AnnouncementInput) =>
      request("POST", `/orgs/${orgId}/announcements`, z.object({ id: z.string() }), body),
    comments: (orgId: string, entityType: CommentEntity, entityId: string) =>
      request("GET", `/orgs/${orgId}/comments`, z.array(commentItem), undefined, { entityType, entityId }),
    addComment: (orgId: string, body: CommentInput) =>
      request("POST", `/orgs/${orgId}/comments`, z.object({ id: z.string() }), body),
    report: (
      orgId: string,
      body: {
        entityType: "comment" | "video" | "announcement";
        entityId: string;
        reason: "inappropriate" | "harassment" | "privacy" | "other";
        detail?: string;
      },
    ) => request("POST", `/orgs/${orgId}/reports`, okResponse, body),
    block: (userId: string) => request("POST", "/blocks", okResponse, { userId }),
    setSpaceConsent: (orgId: string, kind: "health" | "video", granted: boolean) =>
      request(
        "PUT",
        `/orgs/${orgId}/athlete/consents`,
        z.object({ health: z.boolean(), video: z.boolean(), terms: z.boolean() }),
        {
          kind,
          granted,
        },
      ),
  };
};

export type ApiClient = ReturnType<typeof createApiClient>;
