import { m } from "@tartan/i18n";
import { Redirect, Tabs } from "expo-router";
import { useActiveSpace } from "../../src/lib/queries";
import { useSession } from "../../src/lib/session-store";
import { BarGlyph } from "../../src/ui/glyphs";
import { Calendar, Home, Megaphone, TrendingUp } from "../../src/ui/icons";
import { useTabBarOptions } from "../../src/ui/tabs";

export default function AthleteLayout() {
  const status = useSession((s) => s.status);
  const options = useTabBarOptions();
  const { me, space } = useActiveSpace();
  if (status !== "signed-in") return <Redirect href="/sign-in" />;
  if (me.data && space?.role !== "athlete") return <Redirect href="/" />;
  return (
    <Tabs screenOptions={options}>
      <Tabs.Screen
        name="today"
        options={{ title: m.nav.aujourdhui, tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="agenda"
        options={{ title: m.nav.calendrier, tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: m.nav.progres, tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="jumps"
        options={{ title: m.nav.mesSauts, tabBarIcon: ({ color, size }) => <BarGlyph color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="news"
        options={{ title: m.nav.annonces, tabBarIcon: ({ color, size }) => <Megaphone color={color} size={size} /> }}
      />
    </Tabs>
  );
}
