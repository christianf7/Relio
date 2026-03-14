import { memo, useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
  Dimensions.get("window");

interface OrbConfig {
  startX: number;
  startY: number;
  size: number;
  color: string;
  driftY: number;
  driftX: number;
  durationY: number;
  durationX: number;
  durationScale: number;
  delay: number;
}

const DEFAULT_ORBS: OrbConfig[] = [
  {
    startX: -40,
    startY: SCREEN_HEIGHT * 0.12,
    size: 220,
    color: "#6C3CE0",
    driftY: 30,
    driftX: 20,
    durationY: 4000,
    durationX: 5000,
    durationScale: 3000,
    delay: 0,
  },
  {
    startX: SCREEN_WIDTH * 0.55,
    startY: SCREEN_HEIGHT * 0.06,
    size: 180,
    color: "#E04882",
    driftY: 25,
    driftX: 18,
    durationY: 4400,
    durationX: 5600,
    durationScale: 3400,
    delay: 200,
  },
  {
    startX: SCREEN_WIDTH * 0.15,
    startY: SCREEN_HEIGHT * 0.4,
    size: 160,
    color: "#4880E0",
    driftY: 28,
    driftX: 22,
    durationY: 4800,
    durationX: 5200,
    durationScale: 3200,
    delay: 400,
  },
  {
    startX: SCREEN_WIDTH * 0.6,
    startY: SCREEN_HEIGHT * 0.55,
    size: 200,
    color: "#6C3CE0",
    driftY: 32,
    driftX: 16,
    durationY: 4200,
    durationX: 5400,
    durationScale: 3600,
    delay: 600,
  },
  {
    startX: SCREEN_WIDTH * 0.3,
    startY: SCREEN_HEIGHT * 0.75,
    size: 140,
    color: "#E04882",
    driftY: 22,
    driftX: 15,
    durationY: 4600,
    durationX: 5800,
    durationScale: 3100,
    delay: 300,
  },
];

const easeInOutSin = Easing.inOut(Easing.sin);

function Orb({ config }: { config: OrbConfig }) {
  const { startX, startY, size, color, delay } = config;
  const { driftY, driftX, durationY, durationX, durationScale } = config;

  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(0.7, { duration: 1200 }));

    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-driftY, { duration: durationY, easing: easeInOutSin }),
          withTiming(driftY, { duration: durationY, easing: easeInOutSin }),
          withTiming(0, { duration: durationY, easing: easeInOutSin }),
        ),
        -1,
        false,
      ),
    );

    translateX.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(driftX, { duration: durationX, easing: easeInOutSin }),
          withTiming(-driftX, { duration: durationX, easing: easeInOutSin }),
          withTiming(0, { duration: durationX, easing: easeInOutSin }),
        ),
        -1,
        false,
      ),
    );

    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.1, { duration: durationScale, easing: easeInOutSin }),
          withTiming(0.9, { duration: durationScale, easing: easeInOutSin }),
          withTiming(1, { duration: durationScale, easing: easeInOutSin }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: startX,
          top: startY,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        animatedStyle,
      ]}
    >
      <LinearGradient
        colors={[color, `${color}00`]}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
        }}
        start={{ x: 0.3, y: 0.1 }}
        end={{ x: 0.8, y: 0.9 }}
      />
    </Animated.View>
  );
}

const MemoOrb = memo(Orb);

interface FloatingOrbsProps {
  opacity?: number;
  orbs?: OrbConfig[];
}

function FloatingOrbs({ opacity = 1, orbs = DEFAULT_ORBS }: FloatingOrbsProps) {
  return (
    <View style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {orbs.map((config, i) => (
        <MemoOrb key={i} config={config} />
      ))}
    </View>
  );
}

export default memo(FloatingOrbs);
