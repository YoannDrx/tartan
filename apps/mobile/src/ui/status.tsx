import type { CellStatus } from "@tartan/contracts";
import { m } from "@tartan/i18n";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { color } from "./theme";

// Jamais la couleur seule : coche, demi-disque, croix, contour pointillé.
export const StatusGlyph = ({ status, size = 26 }: { status: CellStatus; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 26 26">
    {status === "done" ? (
      <>
        <Circle cx={13} cy={13} r={12} fill={color.status.done} />
        <Path
          d="M8 13.5l3.2 3.2L18 10"
          fill="none"
          stroke={color.white}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    ) : null}
    {status === "partial" ? (
      <>
        <Circle cx={13} cy={13} r={11} fill={color.white} stroke={color.status.partial} strokeWidth={2} />
        <Path d="M13 2 A 11 11 0 0 1 13 24 Z" fill={color.status.partial} />
      </>
    ) : null}
    {status === "missed" ? (
      <>
        <Circle cx={13} cy={13} r={12} fill={color.status.missed} />
        <Path d="M9 9l8 8M17 9l-8 8" stroke={color.white} strokeWidth={2.4} strokeLinecap="round" />
      </>
    ) : null}
    {status === "upcoming" ? (
      <Circle cx={13} cy={13} r={11} fill="none" stroke={color.status.upcoming} strokeWidth={2} strokeDasharray="3 3" />
    ) : null}
  </Svg>
);

export const StatusDisc = ({ status, size = 26, label }: { status: CellStatus; size?: number; label?: string }) => (
  <View
    accessible
    accessibilityRole="image"
    accessibilityLabel={label ?? m.status[status]}
    style={{ width: size, height: size }}
  >
    <StatusGlyph status={status} size={size} />
  </View>
);
