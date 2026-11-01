export const PERSONAL_INVITATION_DAYS = 7;
export const GROUP_LINK_DEFAULT_DAYS = 90;

export type InvitationState = "valid" | "expired" | "revoked" | "used";

export const invitationStateOf = (
  inv: {
    status: string;
    expiresAt: Date | null;
    maxUses: number | null;
    useCount: number;
  },
  now: Date,
): InvitationState => {
  if (inv.status === "revoked") return "revoked";
  if (inv.expiresAt && inv.expiresAt < now) return "expired";
  if (inv.maxUses !== null && inv.useCount >= inv.maxUses) return "used";
  return "valid";
};

export const invitationDefaults = (kind: string): { days: number; maxUses: number | null } =>
  kind === "personal_email" || kind === "personal_sms"
    ? { days: PERSONAL_INVITATION_DAYS, maxUses: 1 }
    : { days: GROUP_LINK_DEFAULT_DAYS, maxUses: null };
