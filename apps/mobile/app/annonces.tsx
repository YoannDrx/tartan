import { Redirect } from "expo-router";
import { useMe } from "../src/lib/queries";
import { useSession } from "../src/lib/session-store";
import { pickSpace, useSpaceStore } from "../src/lib/space-store";

// Le chemin du site mène à l'onglet du bon rôle.
export default function Announcements() {
  const status = useSession((s) => s.status);
  const me = useMe(status === "signed-in");
  const activeOrgId = useSpaceStore((s) => s.activeOrgId);
  if (!me.data) return null;
  const space = pickSpace(me.data.spaces, activeOrgId);
  return <Redirect href={space?.role === "athlete" ? "/news" : "/announcements"} />;
}
