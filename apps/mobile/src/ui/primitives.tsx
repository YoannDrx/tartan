import type { LucideIcon } from "lucide-react-native";
import { forwardRef, useState, type ReactNode } from "react";
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
import { color, radius, space, textStyles, TOUCH, usePalette, type TextVariant } from "./theme";

type TProps = TextProps & {
  variant?: TextVariant;
  tone?: "default" | "muted" | "link" | "white" | "danger";
  heading?: boolean;
  style?: StyleProp<TextStyle>;
};

export const T = ({ variant = "body", tone = "default", heading, style, ...rest }: TProps) => {
  const p = usePalette();
  const tones = {
    default: p.text,
    muted: p.textMuted,
    link: p.link,
    white: color.white,
    danger: p.dark ? color.brandOnInk : color.brandStrong,
  };
  return (
    <Text
      accessibilityRole={heading ? "header" : undefined}
      maxFontSizeMultiplier={variant === "tab" ? 1.2 : 1.6}
      selectionColor={p.accent}
      {...rest}
      style={[textStyles[variant], { color: tones[tone] }, style]}
    />
  );
};

export type ButtonVariant = "primary" | "secondary" | "ghost" | "onBrand" | "onBrandOutline" | "danger";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
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
  compact,
  style,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ButtonProps) => {
  const p = usePalette();
  const looks: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: p.accent, fg: p.accentText },
    secondary: { bg: p.dark ? color.ink : color.surface, fg: p.text, border: p.dark ? color.ink3 : color.border },
    ghost: { bg: "transparent", fg: p.link },
    onBrand: { bg: color.white, fg: color.brandStrong },
    onBrandOutline: { bg: "transparent", fg: color.white, border: color.white },
    danger: {
      bg: p.dark ? color.ink : color.surface,
      fg: p.dark ? color.brandOnInk : color.brandStrong,
      border: p.dark ? color.ink3 : color.border,
    },
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
      accessibilityState={{ disabled: off, busy: Boolean(loading) }}
      android_ripple={{ color: p.ripple }}
      style={({ pressed }) => [
        {
          minHeight: compact ? TOUCH : 52,
          paddingHorizontal: compact ? space.lg : space.xl,
          paddingVertical: space.sm,
          borderRadius: radius.pill,
          backgroundColor: look.bg,
          borderWidth: look.border ? 1 : 0,
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
        maxFontSizeMultiplier={1.4}
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
    filled: p.dark ? color.ink2 : color.surfaceSunk,
    accent: p.accent,
    inverse: color.white,
  }[tone];
  const fg = { plain: p.text, filled: p.text, accent: p.accentText, inverse: color.ink }[tone];
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
  const onBg = p.dark ? color.white : color.ink;
  const onFg = p.dark ? color.ink : color.white;
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
        backgroundColor: active ? onBg : p.dark ? color.ink : color.surface,
        borderWidth: active ? 0 : 1,
        borderColor: p.dark ? color.ink3 : color.border,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
        style={[active ? textStyles.smallStrong : textStyles.small, { color: active ? onFg : p.text }]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

export const Tag = ({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "onBrand" | "brand" }) => {
  const p = usePalette();
  const looks = {
    neutral: { bg: p.dark ? color.ink3 : color.surfaceSunk, fg: p.dark ? color.white : color.muted },
    onBrand: { bg: color.white, fg: color.brandStrong },
    brand: { bg: color.brandTint, fg: color.brandStrong },
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
    const [focused, setFocused] = useState(false);
    return (
      <View style={[{ gap: space.xs + 2 }, containerStyle]}>
        {hideLabel ? null : (
          <T variant="smallStrong" nativeID={`label-${label}`}>
            {label}
          </T>
        )}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={hint}
          accessibilityLabelledBy={hideLabel ? undefined : `label-${label}`}
          placeholderTextColor={p.dark ? color.mutedOnInk : color.muted}
          selectionColor={p.accent}
          cursorColor={p.accent}
          maxFontSizeMultiplier={1.4}
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
              borderColor: error ? color.brandStrong : focused ? p.text : p.dark ? color.ink3 : color.border,
              backgroundColor: p.dark ? color.ink : color.surface,
              color: p.text,
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

export const SectionTitle = ({ children, right }: { children: string; right?: ReactNode }) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.md,
      minHeight: 20,
    }}
  >
    <T variant="section" tone="muted" accessibilityRole="header">
      {children}
    </T>
    {right}
  </View>
);

export const Divider = () => {
  const p = usePalette();
  return <View style={{ height: 1, backgroundColor: p.border }} />;
};

// Surface unique pour une liste : bordures plutôt qu'ombres, lisibles au soleil.
export const ListSurface = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => {
  const p = usePalette();
  return (
    <View
      style={[
        {
          backgroundColor: p.surface,
          borderRadius: radius.block,
          borderWidth: p.dark ? 0 : 1,
          borderColor: p.border,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export const Avatar = ({ initials, size = 32 }: { initials: string; size?: number }) => {
  const p = usePalette();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: p.dark ? color.ink3 : color.surfaceSunk,
        alignItems: "center",
        justifyContent: "center",
      }}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Text
        maxFontSizeMultiplier={1.1}
        style={[
          size >= 40 ? textStyles.smallStrong : textStyles.caption,
          { color: p.text, fontFamily: textStyles.smallStrong.fontFamily },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
};

export const initialsOf = (first?: string | null, last?: string | null, fallback = ""): string => {
  const value = `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
  return value || fallback.slice(0, 2).toUpperCase();
};
