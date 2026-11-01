import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { jumpRoute, parseSpaceParam } from "../../src/lib/deep-links";
import { useSpaceStore } from "../../src/lib/space-store";

// Lien d'un saut du site : il s'ouvre dans l'analyse vidéo.
export default function JumpLink() {
  const { id, espace } = useLocalSearchParams<{ id: string; espace?: string }>();
  const setActive = useSpaceStore((s) => s.setActive);
  const space = parseSpaceParam(espace);
  useEffect(() => {
    if (space) setActive(space);
  }, [space, setActive]);
  return <Redirect href={jumpRoute(id) as never} />;
}
