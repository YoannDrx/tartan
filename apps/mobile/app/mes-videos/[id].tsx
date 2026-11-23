import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { parseSpaceParam, videoRoute } from "../../src/lib/deep-links";
import { useSpaceStore } from "../../src/lib/space-store";

// Lien d'une vidéo du site (« /mes-videos/<id> ») : il s'ouvre dans l'analyse vidéo, dans le bon espace.
export default function VideoLink() {
  const { id, espace } = useLocalSearchParams<{ id: string; espace?: string }>();
  const setActive = useSpaceStore((s) => s.setActive);
  const space = parseSpaceParam(espace);
  useEffect(() => {
    if (space) setActive(space);
  }, [space, setActive]);
  return <Redirect href={videoRoute(id) as never} />;
}
