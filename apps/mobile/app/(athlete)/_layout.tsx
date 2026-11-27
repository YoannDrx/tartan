import { m } from "@tartan/i18n";
import { Redirect, Tabs, useRouter } from "expo-router";
import { isPersonalSpace } from "../../src/lib/personal-space";
import { useActiveSpace } from "../../src/lib/queries";
import { useSession } from "../../src/lib/session-store";
import { BarGlyph } from "../../src/ui/glyphs";
import { Calendar, Dumbbell, Home, Megaphone, Pencil, TrendingUp } from "../../src/ui/icons";
import { useTabBarOptions, useWorldScene } from "../../src/ui/tabs";

export default function AthleteLayout() {
  const status = useSession((s) => s.status);
  const options = useTabBarOptions();
  const worldScene = useWorldScene();
  const { me, space } = useActiveSpace();
  const router = useRouter();
  if (status !== "signed-in") return <Redirect href="/sign-in" />;
  if (me.data && space?.role !== "athlete") return <Redirect href="/" />;
  // L'athlète autonome, dans son espace personnel : ses rubriques d'athlète, plus « Planifier ». Pas d'annonces.
  const personal = isPersonalSpace(space);
  // L'athlète d'un club : « Planifier » ouvre le planificateur de son carnet, ou mène à l'ouverture du carnet.
  const notebook = me.data?.spaces.find((s) => s.kind === "personal");
  const clubPlanner = !personal && Boolean(notebook ? notebook.aiPlannerEnabled : me.data?.notebook?.available);
  return (
    <Tabs screenOptions={options}>
      <Tabs.Screen
        name="today"
        options={{
          ...worldScene("piste"),
          title: m.nav.aujourdhui,
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          ...worldScene("work"),
          title: m.nav.calendrier,
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          ...worldScene("work"),
          href: personal || clubPlanner ? undefined : null,
          title: m.mobile.solo.plan,
          tabBarButtonTestID: "tab-plan",
          tabBarIcon: ({ color, size }) => <Pencil color={color} size={size} />,
        }}
        listeners={{
          tabPress: (event) => {
            if (personal) return;
            event.preventDefault();
            router.push("/planner");
          },
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          ...worldScene("work"),
          title: m.nav.progres,
          tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="mes-videos"
        options={{
          ...worldScene("work"),
          title: m.nav.mesSauts,
          tabBarIcon: ({ color, size }) => <BarGlyph color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="bibliotheque"
        options={{
          ...worldScene("work"),
          title: m.nav.exercices,
          tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          ...worldScene("work"),
          href: null,
          title: m.nav.annonces,
          tabBarIcon: ({ color, size }) => <Megaphone color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
