import { m } from "@tartan/i18n";
import { type ReactNode, useEffect, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "./icons";
import { IconButton, T } from "./primitives";
import { GUTTER, radius, Scene, space, usePalette } from "./theme";

type SheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  // Pictogramme à côté du titre et action fixe sous celui-ci, hors du défilement.
  titleIcon?: ReactNode;
  headerAction?: ReactNode;
  dark?: boolean;
};

const SheetBody = ({
  title,
  onClose,
  children,
  footer,
  titleIcon,
  headerAction,
}: Omit<SheetProps, "visible" | "dark">) => {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  // Clavier ouvert, la zone du bas n'a plus à éviter l'indicateur d'accueil : le champ reste collé au clavier.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () =>
      setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () =>
      setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, justifyContent: "flex-end" }}
    >
      <Pressable
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: p.scrim }}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={m.mobile.a11y.closeSheet}
      />
      <View
        accessibilityViewIsModal
        style={{
          maxHeight: "88%",
          backgroundColor: p.bg,
          borderTopLeftRadius: radius.hero,
          borderTopRightRadius: radius.hero,
          paddingBottom: keyboardOpen ? 0 : Math.max(insets.bottom, space.lg),
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            paddingLeft: GUTTER,
            paddingRight: space.sm,
            paddingTop: space.sm,
          }}
        >
          {titleIcon}
          <T variant="title2" heading style={{ flex: 1 }}>
            {title}
          </T>
          <IconButton icon={X} label={m.common.close} onPress={onClose} />
        </View>
        {headerAction ? (
          <View style={{ paddingHorizontal: GUTTER, paddingTop: space.sm, paddingBottom: space.xs }}>
            {headerAction}
          </View>
        ) : null}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: GUTTER,
            paddingTop: space.sm,
            paddingBottom: space.lg,
            gap: space.lg,
          }}
        >
          {children}
        </ScrollView>
        {footer ? <View style={{ paddingHorizontal: GUTTER, paddingTop: space.sm }}>{footer}</View> : null}
      </View>
    </KeyboardAvoidingView>
  );
};

// Le retour Android ferme la feuille (onRequestClose), jamais l'écran derrière.
export const Sheet = ({ visible, dark: _dark, ...rest }: SheetProps) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={rest.onClose}
    statusBarTranslucent
    navigationBarTranslucent
  >
    <Scene scene="card">
      <SheetBody {...rest} />
    </Scene>
  </Modal>
);
