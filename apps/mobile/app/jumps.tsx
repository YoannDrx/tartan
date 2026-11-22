import { Redirect } from "expo-router";
import { MY_VIDEOS_ROUTE } from "../src/lib/deep-links";

// L'ancienne route interne de l'onglet de l'athlète (« /jumps ») : un lien ou un état gardé y mène toujours.
export default function OldJumpsRoute() {
  return <Redirect href={MY_VIDEOS_ROUTE as never} />;
}
