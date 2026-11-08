import { tokens } from "@tartan/design-tokens";
import { m } from "@tartan/i18n";
import type { SessionType } from "@tartan/contracts";
import type { LucideIcon } from "lucide-react-native";
import { forwardRef, useId, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { splitTitle } from "./title-mark";
import {
  color,
  palettes,
  radius,
  scene,
  Scene,
  space,
  textStyles,
  TOUCH,
  usePagePad,
  usePalette,
  type TextVariant,
} from "./theme";

type TProps = TextProps & {
  variant?: TextVariant;
  tone?: "default" | "muted" | "link" | "danger";
  heading?: boolean;
  style?: StyleProp<TextStyle>;
};

export const T = ({ variant = "body", tone = "default", heading, style, ...rest }: TProps) => {
  const p = usePalette();
  const tones = {
    default: p.text,
    muted: p.textMuted,
    link: p.link,
    danger: p.danger,
  };
  return (
    <Text
      accessibilityRole={heading ? "header" : undefined}
      maxFontSizeMultiplier={
        variant === "tab" ? 1.2 : p.work ? 2 : variant === "screen" || variant === "display" ? 1.3 : 1.6
      }
      selectionColor={p.focus}
      {...rest}
      style={[textStyles[variant], { color: tones[tone] }, style]}
    />
  );
};

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  selected?: boolean;
  expanded?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

export const Button = ({
  label,
  onPress,
  variant = "primary",
  icon: Icon,
  loading,
  disabled,
  selected,
  expanded,
  compact,
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) => {
  const p = usePalette();
  // Sur un monde : l'accent et un contour plein. Sur l'encre : l'accent et une rangée surélevée.
  const raised = p.outlined
    ? { bg: "transparent", border: p.lane, borderWidth: 2 }
    : { bg: p.surface, border: p.border, borderWidth: 1 };
  const looks: Record<ButtonVariant, { bg: string; fg: string; border?: string; borderWidth?: number }> = {
    primary: { bg: p.accent, fg: p.accentText },
    secondary: { ...raised, fg: p.text },
    ghost: { bg: "transparent", fg: p.link },
    danger: { ...raised, fg: p.danger },
  };
  const look = looks[variant];
  const off = Boolean(disabled || loading);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: off,
        busy: Boolean(loading),
        ...(selected === undefined ? {} : { selected }),
        ...(expanded === undefined ? {} : { expanded }),
      }}
      android_ripple={{ color: p.ripple }}
      style={({ pressed }) => [
        {
          minHeight: compact ? TOUCH : 52,
          paddingHorizontal: compact ? space.lg : space.xl,
          paddingVertical: space.sm,
          borderRadius: radius.pill,
          backgroundColor: look.bg,
          borderWidth: look.borderWidth ?? 0,
          borderColor: look.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          opacity: off ? 0.55 : pressed ? 0.85 : 1,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={look.fg} />
      ) : Icon ? (
        <Icon size={20} color={look.fg} strokeWidth={2.2} accessibilityElementsHidden importantForAccessibility="no" />
      ) : null}
      <Text
        maxFontSizeMultiplier={p.work ? 2 : 1.4}
        style={[textStyles.bodyStrong, { color: look.fg, textAlign: "center", flexShrink: 1 }]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

type IconButtonProps = {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  tone?: "plain" | "filled" | "accent" | "inverse";
  shape?: "round" | "square";
  size?: number;
  disabled?: boolean;
  selected?: boolean;
  testID?: string;
};

export const IconButton = ({
  icon: Icon,
  label,
  onPress,
  tone = "plain",
  shape = "round",
  size = TOUCH,
  disabled,
  selected,
  testID,
}: IconButtonProps) => {
  const p = usePalette();
  const bg = {
    plain: "transparent",
    filled: p.raised,
    accent: p.accent,
    inverse: color.white,
  }[tone];
  const fg = { plain: p.text, filled: p.onRaised, accent: p.accentText, inverse: color.ink }[tone];
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(selected) }}
      hitSlop={size < TOUCH ? (TOUCH - size) / 2 : undefined}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: shape === "round" ? size / 2 : radius.button,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
      })}
    >
      <Icon size={20} color={fg} strokeWidth={2.2} accessibilityElementsHidden importantForAccessibility="no" />
    </Pressable>
  );
};

type ChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  minWidth?: number;
  tall?: boolean;
  testID?: string;
};

// Pastille de filtre : 36 de haut, cible tactile portée à 44.
export const Chip = ({ label, active, onPress, accessibilityLabel, minWidth, tall, testID }: ChipProps) => {
  const p = usePalette();
  const height = tall ? TOUCH : 36;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: Boolean(active) }}
      hitSlop={tall ? undefined : { top: 4, bottom: 4 }}
      style={({ pressed }) => ({
        height,
        minWidth,
        paddingHorizontal: space.md + 2,
        borderRadius: radius.pill,
        backgroundColor: active ? p.accent : p.outlined ? "transparent" : p.surface,
        borderWidth: !active && p.outlined ? 2 : 0,
        borderColor: p.lane,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
        style={[active ? textStyles.smallStrong : textStyles.small, { color: active ? p.accentText : p.text }]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

export type TagTone = "neutral" | "brand" | "jump" | "warning" | "alert";

// brand : l'accent. jump : le rouge piste, réservé au type « saut ». warning et alert ne servent que sur l'encre.
export const Tag = ({ label, tone = "neutral" }: { label: string; tone?: TagTone }) => {
  const p = usePalette();
  const looks = {
    neutral: { bg: p.world ? p.surface : p.surfaceAlt, fg: p.onRaised },
    brand: { bg: p.accent, fg: p.accentText },
    jump: { bg: color.brand, fg: color.white },
    warning: { bg: scene.status.partial, fg: scene.onStatus },
    alert: { bg: scene.status.missed, fg: scene.onStatus },
  }[tone];
  return (
    <View
      style={{
        paddingHorizontal: space.sm,
        paddingVertical: 3,
        borderRadius: radius.thumb,
        backgroundColor: looks.bg,
        alignSelf: "flex-start",
      }}
    >
      <Text
        maxFontSizeMultiplier={1.3}
        style={[textStyles.caption, { color: looks.fg, fontFamily: textStyles.smallStrong.fontFamily }]}
      >
        {label}
      </Text>
    </View>
  );
};

type FieldProps = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
  hideLabel?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export const Field = forwardRef<TextInput, FieldProps>(
  ({ label, error, hint, hideLabel, containerStyle, style, onFocus, onBlur, ...rest }, ref) => {
    const p = usePalette();
    const field = p.world ? palettes[p.cardScene] : p;
    const labelId = useId();
    const [focused, setFocused] = useState(false);
    return (
      <View style={[{ gap: space.xs + 2 }, containerStyle]}>
        {hideLabel ? null : (
          <T variant="smallStrong" nativeID={labelId}>
            {label}
          </T>
        )}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={hint}
          accessibilityLabelledBy={hideLabel ? undefined : labelId}
          placeholderTextColor={field.textMuted}
          selectionColor={field.focus}
          cursorColor={field.focus}
          keyboardAppearance={field.dark ? "dark" : "light"}
          maxFontSizeMultiplier={p.work ? 2 : 1.4}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
          style={[
            textStyles.body,
            {
              minHeight: TOUCH + 4,
              paddingHorizontal: space.lg,
              paddingVertical: space.sm,
              borderRadius: radius.button,
              borderWidth: focused ? 2 : 1,
              borderColor: error ? field.danger : focused ? field.focus : field.controlLine,
              backgroundColor: field.surface,
              color: field.text,
            },
            rest.multiline ? { minHeight: 88, textAlignVertical: "top", paddingTop: space.md } : null,
            style,
          ]}
        />
        {hint && !error ? (
          <T variant="caption" tone="muted">
            {hint}
          </T>
        ) : null}
        {error ? (
          <T variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {error}
          </T>
        ) : null}
      </View>
    );
  },
);
Field.displayName = "Field";

type ScreenTitleProps = {
  title: string;
  variant?: TextVariant;
  numberOfLines?: number;
  testID?: string;
  style?: StyleProp<TextStyle>;
};

// Le titre d'écran : le dernier mot sur un aplat accent. Le lecteur d'écran lit le titre entier, une seule fois.
export const ScreenTitle = ({ title, variant = "screen", numberOfLines, testID, style }: ScreenTitleProps) => {
  const p = usePalette();
  const { lead, mark } = splitTitle(title);
  if (p.work)
    return (
      <T
        variant={variant === "screen" ? "title1" : variant}
        heading
        testID={testID}
        numberOfLines={numberOfLines}
        accessibilityLabel={title}
        style={style}
      >
        {title}
      </T>
    );
  return (
    <T
      variant={variant}
      heading
      testID={testID}
      numberOfLines={numberOfLines}
      maxFontSizeMultiplier={1.3}
      accessibilityLabel={title}
      style={style}
    >
      {lead}
      <Text style={{ backgroundColor: p.accent, color: p.accentText }}>{`\u00A0${mark}\u00A0`}</Text>
    </T>
  );
};

export const SectionTitle = ({ children, right }: { children: string; right?: ReactNode }) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.md,
      minHeight: 24,
    }}
  >
    <T variant="section" heading>
      {children}
    </T>
    {right}
  </View>
);

export const Divider = () => {
  const p = usePalette();
  return <View style={{ height: 1, backgroundColor: p.border }} />;
};

// Le monde est le fond, jamais une carte : le contenu se pose sur une carte encre, qui change la scène de ses enfants.
export const ListSurface = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => {
  const p = usePalette();
  const body = (
    <View style={[{ backgroundColor: p.surface, borderRadius: radius.card, overflow: "hidden" }, style]}>
      {children}
    </View>
  );
  return p.world ? <Scene scene={p.cardScene}>{body}</Scene> : body;
};

// Carte encre avec sa marge intérieure. Pas de carte dans une carte : à l'intérieur, des lignes et des rangées.
export const Card = ({
  children,
  style,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) => (
  <ListSurface style={[{ padding: space.lg, gap: space.md }, style]}>
    <View testID={testID} style={{ gap: space.md }}>
      {children}
    </View>
  </ListSurface>
);

// La signature : un trait plein de 3 px, à bord perdu, sous le titre et entre les grandes sections.
export const LaneLine = () => {
  const p = usePalette();
  const pad = usePagePad();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: p.work ? 1 : 3, backgroundColor: p.lane, marginHorizontal: p.work ? 0 : -pad }}
    />
  );
};

// Même poids visuel pour chaque pratique ; le libellé porte toujours le sens.
export const ActivityTag = ({ type }: { type: SessionType }) => {
  const tint = tokens.activity[type];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: radius.thumb,
        paddingHorizontal: space.sm,
        paddingVertical: 2,
        backgroundColor: tint.background,
      }}
    >
      <T variant="caption" style={{ color: tint.text }}>
        {m.sessionType[type]}
      </T>
    </View>
  );
};
