import { isStaff } from "@tartan/domain";
import { m } from "@tartan/i18n";
import { Redirect, Tabs } from "expo-router";
import { useActiveSpace } from "../../src/lib/queries";
import { useSession } from "../../src/lib/session-store";
import { BarChart, Calendar, Library, Megaphone, Video } from "../../src/ui/icons";
import { useTabBarOptions, worldScene } from "../../src/ui/tabs";

export default function CoachLayout() {
  const status = useSession((s) => s.status);
  const options = useTabBarOptions();
  const { me, space } = useActiveSpace();
  if (status !== "signed-in") return <Redirect href="/sign-in" />;
  if (me.data && (!space || !isStaff(space.role))) return <Redirect href="/" />;
  return (
    <Tabs screenOptions={options}>
      <Tabs.Screen
        name="tracking"
        options={{
          ...worldScene("work"),
          title: m.nav.suivi,
          tabBarIcon: ({ color, size }) => <BarChart color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="planning"
        options={{
          ...worldScene("work"),
          title: m.nav.calendrier,
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          ...worldScene("work"),
          title: m.nav.exercices,
          tabBarIcon: ({ color, size }) => <Library color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          ...worldScene("work"),
          title: m.nav.videos,
          tabBarIcon: ({ color, size }) => <Video color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="announcements"
        options={{
          ...worldScene("work"),
          title: m.nav.annonces,
          tabBarIcon: ({ color, size }) => <Megaphone color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
