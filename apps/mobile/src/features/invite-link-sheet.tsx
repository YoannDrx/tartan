import { m } from "@tartan/i18n";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { parseInviteToken } from "../lib/invite-link";
import { usePendingInvite } from "../lib/pending-invite";
import { Button, Field, T } from "../ui/primitives";
import { Sheet } from "../ui/sheet";
import { space } from "../ui/theme";

// Première installation : le lien ouvert avant l'installation est perdu, il se colle ici.
// Le presse-papiers n'est lu qu'au toucher du bouton, jamais à l'ouverture de l'écran.
export const InviteLinkSheet = ({ onClose }: { onClose: () => void }) => {
  const router = useRouter();
  const keep = usePendingInvite((s) => s.keep);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const open = (input: string, message: string) => {
    const token = parseInviteToken(input);
    if (!token) {
      setError(message);
      return;
    }
    keep(token);
    onClose();
    router.replace(`/i/${token}`);
  };

  return (
    <Sheet
      visible
      title={m.mobile.inviteLink.title}
      onClose={onClose}
      footer={
        <Button
          testID="invite-link-submit"
          label={m.mobile.inviteLink.submit}
          onPress={() => open(value, m.mobile.inviteLink.invalid)}
        />
      }
    >
      <T>{m.mobile.inviteLink.lead}</T>
      <Field
        testID="invite-link-input"
        label={m.mobile.inviteLink.label}
        value={value}
        onChangeText={(v) => {
          setValue(v);
          setError(null);
        }}
        placeholder={m.mobile.inviteLink.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
        onSubmitEditing={() => open(value, m.mobile.inviteLink.invalid)}
        error={error}
      />
      <View style={{ alignSelf: "flex-start" }}>
        <Button
          testID="invite-link-paste"
          label={m.mobile.inviteLink.paste}
          variant="secondary"
          compact
          onPress={() => {
            void Clipboard.getStringAsync()
              .then((text) => {
                setValue(text);
                open(text, m.mobile.inviteLink.pasteEmpty);
              })
              .catch(() => setError(m.mobile.inviteLink.pasteEmpty));
          }}
        />
      </View>
    </Sheet>
  );
};
