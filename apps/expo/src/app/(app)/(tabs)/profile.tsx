import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";

import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

let GlassView: React.ComponentType<any> | null = null;
try {
  GlassView = require("expo-glass-effect").GlassView;
} catch {
  GlassView = null;
}

type EnrolledUnit = { code: string; university: string };

function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getPrimaryUniversity(units: EnrolledUnit[]): string | null {
  if (units.length === 0) return null;
  const counts = new Map<string, number>();
  for (const u of units) {
    counts.set(u.university, (counts.get(u.university) ?? 0) + 1);
  }
  let max = 0;
  let primary: string | null = null;
  for (const [uni, count] of counts) {
    if (count > max) {
      max = count;
      primary = uni;
    }
  }
  return primary;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const { data: profile, isLoading } = useQuery(
    trpc.user.getMe.queryOptions(),
  );

  const fullName = profile?.displayName ?? profile?.name ?? session?.user?.name ?? "User";
  const email = profile?.email ?? session?.user?.email ?? "";
  const imageUrl = profile?.image ?? null;

  const enrolledUnits: EnrolledUnit[] = useMemo(() => {
    if (!profile?.enrolledUnits) return [];
    if (Array.isArray(profile.enrolledUnits)) return profile.enrolledUnits as EnrolledUnit[];
    return [];
  }, [profile?.enrolledUnits]);

  const university = useMemo(
    () => getPrimaryUniversity(enrolledUnits),
    [enrolledUnits],
  );

  const connectionsCount = profile?.connectionsCount ?? 0;
  const eventsCount = profile?.eventsCount ?? 0;
  const userId = profile?.id ?? session?.user?.id ?? "";

  const handleSignOut = useCallback(async () => {
    await authClient.signOut();
  }, []);

  if (isLoading && !profile) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#6C3CE0" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + Name */}
        <View style={styles.profileHeader}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={["#6C3CE0", "#E04882"]}
              style={styles.avatar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.avatarText}>{getInitials(fullName)}</Text>
            </LinearGradient>
          )}
          <Text style={styles.name}>{fullName}</Text>
          {email ? <Text style={styles.email}>{email}</Text> : null}
          {university ? (
            <View style={styles.universityBadge}>
              <Ionicons
                name="school-outline"
                size={13}
                color="rgba(108, 60, 224, 1)"
              />
              <Text style={styles.universityText}>{university}</Text>
            </View>
          ) : null}
        </View>

        {/* Stats */}
        <GlassCard style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{connectionsCount}</Text>
              <Text style={styles.statLabel}>Connections</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{eventsCount}</Text>
              <Text style={styles.statLabel}>Events</Text>
            </View>
          </View>
        </GlassCard>

        {/* Edit Profile Button */}
        <Pressable
          onPress={() => router.push("/(app)/edit-profile" as any)}
          style={({ pressed }) => [
            styles.editButton,
            pressed && styles.editButtonPressed,
          ]}
        >
          <Ionicons name="pencil-outline" size={16} color="#FFFFFF" />
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </Pressable>

        {/* Enrolled Units */}
        {enrolledUnits.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Courses</Text>
            <View style={styles.chipContainer}>
              {enrolledUnits.map((unit, index) => (
                <View key={`${unit.code}-${index}`} style={styles.chip}>
                  <Text style={styles.chipText}>{unit.code}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Bio */}
        {profile?.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <GlassCard style={styles.bioCard}>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </GlassCard>
          </View>
        ) : null}

        {/* QR Code */}
        {userId ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My QR Code</Text>
            <GlassCard style={styles.qrCard}>
              <View style={styles.qrInner}>
                <View style={styles.qrBackground}>
                  <QRCode
                    value={`relio://connect/${userId}`}
                    size={180}
                    backgroundColor="#FFFFFF"
                    color="#0A0A1A"
                  />
                </View>
                <Text style={styles.qrHint}>
                  Let others scan this to connect instantly
                </Text>
              </View>
            </GlassCard>
          </View>
        ) : null}

        {/* Socials */}
        {profile?.socials &&
        typeof profile.socials === "object" &&
        Object.values(profile.socials as Record<string, unknown>).some(Boolean) ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Socials</Text>
            <View style={styles.socialsRow}>
              {(profile.socials as { githubUrl?: string; linkedInUrl?: string; discordUrl?: string }).githubUrl ? (
                <View style={styles.socialChip}>
                  <Ionicons name="logo-github" size={16} color="#FFFFFF" />
                  <Text style={styles.socialText}>GitHub</Text>
                </View>
              ) : null}
              {(profile.socials as { githubUrl?: string; linkedInUrl?: string; discordUrl?: string }).linkedInUrl ? (
                <View style={styles.socialChip}>
                  <Ionicons name="logo-linkedin" size={16} color="#FFFFFF" />
                  <Text style={styles.socialText}>LinkedIn</Text>
                </View>
              ) : null}
              {(profile.socials as { githubUrl?: string; linkedInUrl?: string; discordUrl?: string }).discordUrl ? (
                <View style={styles.socialChip}>
                  <Ionicons name="logo-discord" size={16} color="#FFFFFF" />
                  <Text style={styles.socialText}>Discord</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Sign Out */}
        <View style={styles.signOutSection}>
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.signOutButtonPressed,
            ]}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A1A",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    alignItems: "center",
    paddingHorizontal: 24,
  },

  profileHeader: {
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 34,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  name: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  email: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.45)",
    fontWeight: "400",
  },
  universityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    backgroundColor: "rgba(108, 60, 224, 0.15)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
  },
  universityText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(108, 60, 224, 1)",
  },

  statsCard: {
    width: "100%",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
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
    fontSize: 22,
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

  editButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(108, 60, 224, 0.2)",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(108, 60, 224, 0.3)",
    marginBottom: 28,
  },
  editButtonPressed: {
    backgroundColor: "rgba(108, 60, 224, 0.35)",
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  section: {
    width: "100%",
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.5)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.8)",
    letterSpacing: 0.3,
  },

  bioCard: {
    borderRadius: 16,
    padding: 16,
  },
  bioText: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.7)",
    lineHeight: 22,
  },

  qrCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  qrInner: {
    alignItems: "center",
    gap: 16,
  },
  qrBackground: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
  },
  qrHint: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.4)",
    fontWeight: "400",
    textAlign: "center",
  },

  socialsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  socialChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  socialText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.7)",
  },

  signOutSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  signOutButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  signOutButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.5)",
    textAlign: "center",
  },

  glassBase: {
    overflow: "hidden",
  },
  glassFallback: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
});
