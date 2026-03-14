import { Platform, StyleSheet, View } from "react-native";

let GlassViewComponent: React.ComponentType<any> | null = null;
let loadSucceeded = false;

function getGlassView(): React.ComponentType<any> | null {
  if (loadSucceeded) return GlassViewComponent;
  try {
    const mod = require("expo-glass-effect");
    if (mod?.GlassView) {
      GlassViewComponent = mod.GlassView;
      loadSucceeded = true;
    }
  } catch {
    // Native module not available yet or not on iOS - will retry next render
  }
  return GlassViewComponent;
}

type GlassEffectStyle = "regular" | "clear";

interface GlassCardProps {
  children: React.ReactNode;
  style?: any;
  effectStyle?: GlassEffectStyle;
}

export function GlassCard({
  children,
  style,
  effectStyle = "regular",
}: GlassCardProps) {
  const GlassView = getGlassView();

  if (GlassView && Platform.OS === "ios") {
    return (
      <GlassView
        glassEffectStyle={effectStyle}
        style={[styles.base, style]}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[styles.base, styles.fallback, style]}>
      {children}
    </View>
  );
}

export function GlassPill({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <GlassCard effectStyle="clear" style={style}>
      {children}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
  },
  fallback: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
});
