import { m } from "@tartan/i18n";
import { forwardRef, useState, type ComponentProps } from "react";
import type { TextInput } from "react-native";
import { Eye, EyeOff } from "./icons";
import { Field, IconButton } from "./primitives";

type PasswordFieldProps = Omit<ComponentProps<typeof Field>, "secureTextEntry" | "accessory"> & {
  // `new` : un mot de passe à choisir ; `current` : celui qu'on connaît déjà.
  purpose: "new" | "current";
};

// Un champ de mot de passe qui se relit d'un bouton avant l'envoi (DESIGN.md, entrée).
export const PasswordField = forwardRef<TextInput, PasswordFieldProps>(({ purpose, testID, ...rest }, ref) => {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      ref={ref}
      testID={testID}
      {...rest}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete={purpose === "new" ? "new-password" : "current-password"}
      textContentType={purpose === "new" ? "newPassword" : "password"}
      accessory={
        <IconButton
          testID={testID ? `${testID}-reveal` : undefined}
          icon={visible ? EyeOff : Eye}
          label={visible ? m.account.signIn.hidePassword : m.account.signIn.showPassword}
          selected={visible}
          onPress={() => setVisible((v) => !v)}
        />
      }
    />
  );
});
PasswordField.displayName = "PasswordField";
