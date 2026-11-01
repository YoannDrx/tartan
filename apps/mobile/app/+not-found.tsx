import { m } from "@tartan/i18n";
import { useRouter } from "expo-router";
import { Button, T } from "../src/ui/primitives";
import { StackScreen } from "../src/ui/screen";

export default function NotFound() {
  const router = useRouter();
  return (
    <StackScreen>
      <T>{m.common.notFound}</T>
      <Button label={m.common.back} variant="secondary" onPress={() => router.replace("/")} />
    </StackScreen>
  );
}
