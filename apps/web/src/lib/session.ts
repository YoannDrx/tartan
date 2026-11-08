import { headers } from "next/headers";
import { auth } from "./auth";
import { unauthorized } from "./errors";

export type Actor = { userId: string; email: string; sessionId?: string };

export const getActorFrom = async (requestHeaders: Headers): Promise<Actor | null> => {
  const session = await auth.api.getSession({ headers: requestHeaders });
  return session ? { userId: session.user.id, email: session.user.email, sessionId: session.session.id } : null;
};

export const getActor = async (): Promise<Actor | null> => getActorFrom(await headers());

export const requireActor = async (): Promise<Actor> => {
  const actor = await getActor();
  if (!actor) throw unauthorized();
  return actor;
};
