import { useCallback, useEffect, useRef } from "react";
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
import { Stack } from "expo-router";
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
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 0.5,
      duration: 1000,
      delay,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -20,
          duration: 5000 + delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 20,
          duration: 5000 + delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 15,
          duration: 6000 + delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -15,
          duration: 6000 + delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.1,
          duration: 4000 + delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 4000 + delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: startX,
        top: startY,
        width: size,
        height: size,
        borderRadius: size / 2,
        opacity,
        transform: [{ translateY }, { translateX }, { scale }],
      }}
    >
      <LinearGradient
        colors={[color, `${color}00`]}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        start={{ x: 0.3, y: 0.1 }}
        end={{ x: 0.8, y: 0.9 }}
      />
    </Animated.View>
  );
}

function GlassCard({ children, style }: { children: React.ReactNode; style?: any }) {
  if (GlassView && Platform.OS === "ios") {
    return (
      <GlassView glassEffectStyle="regular" style={[styles.glassBase, style]}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[styles.glassBase, styles.glassFallback, style]}>
      {children}
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { data: session } = authClient.useSession();

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 600,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.spring(slideUp, {
        toValue: 0,
        tension: 50,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSignOut = useCallback(async () => {
    await authClient.signOut();
  }, []);

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const fullName = session?.user?.name ?? "User";
  const email = session?.user?.email ?? "";

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={["#0A0A1A", "#1A0A2E", "#16213E", "#0A0A1A"]}
        locations={[0, 0.35, 0.65, 1]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      <FloatingOrb delay={0} startX={-60} startY={SCREEN_HEIGHT * 0.15} size={200} color="#6C3CE0" />
      <FloatingOrb delay={300} startX={SCREEN_WIDTH * 0.6} startY={SCREEN_HEIGHT * 0.08} size={160} color="#E04882" />
      <FloatingOrb delay={500} startX={SCREEN_WIDTH * 0.2} startY={SCREEN_HEIGHT * 0.5} size={180} color="#4880E0" />
      <FloatingOrb delay={200} startX={SCREEN_WIDTH * 0.5} startY={SCREEN_HEIGHT * 0.7} size={140} color="#6C3CE0" />

      <Animated.View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 20,
            opacity: fadeIn,
            transform: [{ translateY: slideUp }],
          },
        ]}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{firstName}</Text>
          </View>
          <GlassCard style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{getInitials(fullName)}</Text>
          </GlassCard>
        </View>

        <GlassCard style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <GlassCard style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {getInitials(fullName)}
              </Text>
            </GlassCard>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{fullName}</Text>
              {email ? <Text style={styles.profileEmail}>{email}</Text> : null}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Connections</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>0</Text>
              <Text style={styles.statLabel}>Interactions</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>New</Text>
              <Text style={styles.statLabel}>Status</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.quickActionsCard}>
          <Text style={styles.sectionTitle}>Getting Started</Text>
          <Text style={styles.sectionSubtitle}>
            Welcome to Relio. We're building something special for you.
          </Text>
        </GlassCard>

        <View style={styles.spacer} />

        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && styles.signOutButtonPressed,
          ]}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>
      </Animated.View>
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
    paddingHorizontal: 24,
    gap: 20,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  greeting: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: "400",
  },
  userName: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  profileCard: {
    borderRadius: 24,
    padding: 24,
    gap: 20,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  profileAvatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  profileEmail: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.5)",
    fontWeight: "400",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.45)",
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },

  quickActionsCard: {
    borderRadius: 24,
    padding: 24,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.5)",
    lineHeight: 20,
  },

  spacer: {
    flex: 1,
  },

  signOutButton: {
    alignSelf: "center",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  signOutButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.6)",
  },

  glassBase: {
    overflow: "hidden",
  },
  glassFallback: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
});
