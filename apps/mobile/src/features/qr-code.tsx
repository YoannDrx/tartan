import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { qrMatrix } from "../lib/qr";
import { color } from "../ui/theme";

const QUIET_ZONE = 4;

// Encre sur blanc, avec sa zone de silence : le rouge de l'app ne doit pas gêner le scan au soleil.
export const QrCode = ({ value, size, label }: { value: string; size: number; label: string }) => {
  const { path, modules } = useMemo(() => {
    const matrix = qrMatrix(value);
    let d = "";
    matrix.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      });
    });
    return { path: d, modules: matrix.length };
  }, [value]);
  const box = modules + QUIET_ZONE * 2;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{ width: size, height: size, backgroundColor: color.white }}
    >
      <Svg width={size} height={size} viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${box} ${box}`}>
        <Path d={path} fill={color.ink} />
      </Svg>
    </View>
  );
};
