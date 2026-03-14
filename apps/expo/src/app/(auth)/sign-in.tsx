import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import FloatingOrbs from "~/components/FloatingOrbs";
import { GlassCard, GlassPill } from "~/components/GlassCard";
import { authClient } from "~/utils/auth";

function LinkedInIcon() {
  return (
    <View style={styles.linkedinIcon}>
      <Text style={styles.linkedinIconText}>in</Text>
    </View>
  );
}

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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

      <FloatingOrbs />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 },
        ]}
      >
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
            <Image
              source={{ uri: "https://relio-cdn.chrisfitz.dev/relio.png" }}
              style={{ width: 88, height: 88 }}
            />
          </GlassCard>

          <Text style={styles.appName}>Relio</Text>

          <GlassPill style={styles.taglinePill}>
            <Text style={styles.tagline}>
              Your professional network, elevated
            </Text>
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
              By continuing, you agree to our{" "}
              <Text
                style={styles.termsLink}
                onPress={() => router.push("/(auth)/terms-of-service" as any)}
              >
                Terms of Service
              </Text>{" "}
              and{" "}
              <Text
                style={styles.termsLink}
                onPress={() => router.push("/(auth)/privacy-policy" as any)}
              >
                Privacy Policy
              </Text>
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
  termsLink: {
    color: "rgba(255, 255, 255, 0.9)",
    textDecorationLine: "underline",
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
});
