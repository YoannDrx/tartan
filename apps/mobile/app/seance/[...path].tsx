import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { parseSpaceParam, sessionRoute } from "../../src/lib/deep-links";
import { useSpaceStore } from "../../src/lib/space-store";

// Lien d'une séance du site, avec ou sans « /mode ».
export default function SessionLink() {
  const { path, espace } = useLocalSearchParams<{ path: string[]; espace?: string }>();
  const setActive = useSpaceStore((s) => s.setActive);
  const space = parseSpaceParam(espace);
  useEffect(() => {
    if (space) setActive(space);
  }, [space, setActive]);
  return <Redirect href={sessionRoute(path) as never} />;
}
