import { Stack } from "expo-router";
import { scene } from "../../src/ui/theme";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: scene.page } }} />;
}
