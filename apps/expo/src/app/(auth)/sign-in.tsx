import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { authClient } from "~/utils/auth";

let GlassView: React.ComponentType<any> | null = null;
try {
  GlassView = require("expo-glass-effect").GlassView;
} catch {
  GlassView = null;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

function FloatingOrb({
  delay,
  startX,
  startY,
  size,
  color,
}: {
  delay: number;
  startX: number;
  startY: number;
  size: number;
  color: string;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fadeIn = Animated.timing(opacity, {
      toValue: 0.7,
      duration: 1200,
      delay,
      useNativeDriver: true,
    });

    const floatY = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -30,
          duration: 4000 + delay * 0.5,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 30,
          duration: 4000 + delay * 0.5,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const floatX = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 20,
          duration: 5000 + delay * 0.3,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -20,
          duration: 5000 + delay * 0.3,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.15,
          duration: 3000 + delay * 0.4,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.85,
          duration: 3000 + delay * 0.4,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    fadeIn.start();
    floatY.start();
    floatX.start();
    pulse.start();

    return () => {
      fadeIn.stop();
      floatY.stop();
      floatX.stop();
      pulse.stop();
    };
  }, []);

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
          opacity,
          transform: [{ translateY }, { translateX }, { scale }],
        },
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

function LinkedInIcon() {
  return (
    <View style={styles.linkedinIcon}>
      <Text style={styles.linkedinIconText}>in</Text>
    </View>
  );
}

function GlassCard({ children, style }: { children: React.ReactNode; style?: any }) {
  if (GlassView && Platform.OS === "ios") {
    return (
      <GlassView
        glassEffectStyle="regular"
        style={[styles.glassCardBase, style]}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[styles.glassCardBase, styles.glassCardFallback, style]}>
      {children}
    </View>
  );
}

function GlassPill({ children, style }: { children: React.ReactNode; style?: any }) {
  if (GlassView && Platform.OS === "ios") {
    return (
      <GlassView
        glassEffectStyle="clear"
        style={[styles.glassPillBase, style]}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[styles.glassPillBase, styles.glassPillFallback, style]}>
      {children}
    </View>
  );
}

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(40)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(contentTranslateY, {
          toValue: 0,
          tension: 50,
          friction: 10,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const handleSignIn = useCallback(async () => {
    setIsSigningIn(true);

    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(buttonScale, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      await authClient.signIn.social({
        provider: "linkedin",
        callbackURL: "/",
      });
    } catch {
      setIsSigningIn(false);
    }
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#1A0A2E", "#16213E", "#0A0A1A"]}
        locations={[0, 0.35, 0.65, 1]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      <FloatingOrb delay={0} startX={-40} startY={SCREEN_HEIGHT * 0.12} size={220} color="#6C3CE0" />
      <FloatingOrb delay={200} startX={SCREEN_WIDTH * 0.55} startY={SCREEN_HEIGHT * 0.06} size={180} color="#E04882" />
      <FloatingOrb delay={400} startX={SCREEN_WIDTH * 0.15} startY={SCREEN_HEIGHT * 0.4} size={160} color="#4880E0" />
      <FloatingOrb delay={600} startX={SCREEN_WIDTH * 0.6} startY={SCREEN_HEIGHT * 0.55} size={200} color="#6C3CE0" />
      <FloatingOrb delay={300} startX={SCREEN_WIDTH * 0.3} startY={SCREEN_HEIGHT * 0.75} size={140} color="#E04882" />

      <View style={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
        <Animated.View
          style={[
            styles.logoSection,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <GlassCard style={styles.logoContainer}>
            <Text style={styles.logoMark}>R</Text>
          </GlassCard>

          <Text style={styles.appName}>Relio</Text>

          <GlassPill style={styles.taglinePill}>
            <Text style={styles.tagline}>Your professional network, elevated</Text>
          </GlassPill>
        </Animated.View>

        <Animated.View
          style={[
            styles.bottomSection,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }],
            },
          ]}
        >
          <GlassCard style={styles.signInCard}>
            <Text style={styles.welcomeTitle}>Welcome</Text>
            <Text style={styles.welcomeSubtitle}>
              Sign in to connect with the people you will interact with
            </Text>

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <Pressable
                onPress={handleSignIn}
                disabled={isSigningIn}
                style={({ pressed }) => [
                  styles.linkedinButton,
                  pressed && styles.linkedinButtonPressed,
                  isSigningIn && styles.linkedinButtonDisabled,
                ]}
              >
                <LinkedInIcon />
                <Text style={styles.linkedinButtonText}>
                  {isSigningIn ? "Connecting..." : "Continue with LinkedIn"}
                </Text>
              </Pressable>
            </Animated.View>

            <Text style={styles.termsText}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </GlassCard>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A1A",
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 28,
  },

  logoSection: {
    alignItems: "center",
    gap: 16,
    paddingTop: 40,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  logoMark: {
    fontSize: 42,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  appName: {
    fontSize: 48,
    fontWeight: "200",
    color: "#FFFFFF",
    letterSpacing: 8,
    textTransform: "uppercase",
    marginTop: 8,
  },
  taglinePill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    marginTop: 4,
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "500",
    letterSpacing: 0.5,
  },

  bottomSection: {
    width: "100%",
    gap: 16,
    alignItems: "center",
  },
  signInCard: {
    width: "100%",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 16,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "400",
    maxWidth: 280,
  },
  linkedinButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A66C2",
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 16,
    gap: 12,
    width: "100%",
    minWidth: 280,
    marginTop: 4,
  },
  linkedinButtonPressed: {
    backgroundColor: "#084E96",
  },
  linkedinButtonDisabled: {
    opacity: 0.7,
  },
  linkedinButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  linkedinIcon: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  linkedinIconText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0A66C2",
    marginTop: -1,
  },
  termsText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.35)",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 4,
  },

  footerPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
  },
  footerText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.45)",
    fontWeight: "500",
    letterSpacing: 0.3,
  },

  glassCardBase: {
    overflow: "hidden",
  },
  glassCardFallback: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  glassPillBase: {
    overflow: "hidden",
  },
  glassPillFallback: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
});
