import { Redirect } from "expo-router";
import { MY_VIDEOS_ROUTE } from "../../src/lib/deep-links";

// L'ancienne adresse de la liste (« /mes-sauts ») : elle mène à « Mes vidéos ».
export default function OldVideosLink() {
  return <Redirect href={MY_VIDEOS_ROUTE as never} />;
}
