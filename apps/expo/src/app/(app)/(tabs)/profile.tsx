import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";

import FloatingOrbs from "~/components/FloatingOrbs";
import { GlassCard } from "~/components/GlassCard";
import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BANNER_HEIGHT = 220;
const AVATAR_SIZE = 110;

type EnrolledUnit = { code: string; university: string };

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

  const { data: profile, isLoading } = useQuery(trpc.user.getMe.queryOptions());

  const fullName =
    profile?.displayName ?? profile?.name ?? session?.user?.name ?? "User";
  const email = profile?.email ?? session?.user?.email ?? "";
  const imageUrl = profile?.image ?? null;
  const slug = (profile as any)?.slug ?? null;

  const enrolledUnits: EnrolledUnit[] = useMemo(() => {
    if (!profile?.enrolledUnits) return [];
    if (Array.isArray(profile.enrolledUnits))
      return profile.enrolledUnits as EnrolledUnit[];
    return [];
  }, [profile?.enrolledUnits]);

  const university = useMemo(
    () => getPrimaryUniversity(enrolledUnits),
    [enrolledUnits],
  );

  const connectionsCount = profile?.connectionsCount ?? 0;
  const eventsCount = profile?.eventsCount ?? 0;
  const pendingRequestCount = profile?.pendingRequestCount ?? 0;
  const unreadDmCount = (profile as any)?.unreadDmCount ?? 0;
  const userId = profile?.id ?? session?.user?.id ?? "";

  const socials = useMemo(() => {
    if (!profile?.socials || typeof profile.socials !== "object") return null;
    return profile.socials as {
      githubUrl?: string;
      linkedInUrl?: string;
      discordUsername?: string;
    };
  }, [profile?.socials]);

  const hasSocials = socials && Object.values(socials).some(Boolean);

  const handleSignOut = useCallback(async () => {
    await authClient.signOut();
  }, []);

  if (isLoading && !profile) {
    return (
      <View
        style={[styles.container, styles.centered, { paddingTop: insets.top }]}
      >
        <ActivityIndicator size="large" color="#6C3CE0" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FloatingOrbs opacity={0.5} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner + Avatar Hero */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={["#2D1B69", "#6C3CE0", "#E04882"]}
            style={styles.banner}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={[styles.decorCircle, { top: -20, right: 60 }]} />
            <View
              style={[
                styles.decorCircle,
                {
                  width: 140,
                  height: 140,
                  borderRadius: 70,
                  bottom: -50,
                  right: -30,
                  opacity: 0.06,
                },
              ]}
            />
            <View
              style={[
                styles.decorCircle,
                {
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  top: 40,
                  left: 30,
                  opacity: 0.12,
                },
              ]}
            />
            <LinearGradient
              colors={["transparent", "rgba(10, 10, 26, 0.6)", "#0A0A1A"]}
              style={styles.bannerFade}
            />
          </LinearGradient>

          {/* Top-right buttons */}
          <View style={[styles.topRightButtons, { top: insets.top + 12 }]}>
            <Pressable
              style={styles.headerActionButton}
              onPress={() =>
                router.push("/(app)/conversations" as any)
              }
            >
              <GlassCard style={styles.settingsButtonInner}>
                <Ionicons
                  name="chatbubble-outline"
                  size={19}
                  color="#FFFFFF"
                />
              </GlassCard>
              {unreadDmCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadDmCount > 99 ? "99+" : unreadDmCount}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              style={styles.headerActionButton}
              onPress={() =>
                router.push("/(app)/connection-requests" as any)
              }
            >
              <GlassCard style={styles.settingsButtonInner}>
                <Ionicons
                  name="mail-outline"
                  size={19}
                  color="#FFFFFF"
                />
              </GlassCard>
              {pendingRequestCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {pendingRequestCount > 99
                      ? "99+"
                      : pendingRequestCount}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              style={styles.headerActionButton}
              onPress={() => router.push("/(app)/edit-profile" as any)}
            >
              <GlassCard style={styles.settingsButtonInner}>
                <Ionicons
                  name="settings-outline"
                  size={20}
                  color="#FFFFFF"
                />
              </GlassCard>
            </Pressable>
          </View>

          {/* Avatar overlay */}
          <View style={styles.avatarWrapper}>
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
            <View style={styles.onlineIndicator} />
          </View>
        </View>

        {/* Name + Handle */}
        <View style={styles.nameSection}>
          <Text style={styles.name}>{fullName}</Text>
          {slug ? (
            <Text style={styles.handle}>@{slug}</Text>
          ) : email ? (
            <Text style={styles.handle}>{email}</Text>
          ) : null}
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

        {/* Bio */}
        {profile?.bio ? (
          <View style={styles.bioSection}>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        ) : null}

        {/* Stats Row */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{connectionsCount}</Text>
            <Text style={styles.statLabel}>connections</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{eventsCount}</Text>
            <Text style={styles.statLabel}>events</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{enrolledUnits.length}</Text>
            <Text style={styles.statLabel}>courses</Text>
          </View>
        </View>

        {/* Edit Profile Button */}
        <View style={styles.actionRow}>
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
        </View>

        <View style={styles.contentArea}>
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

          {/* Socials */}
          {hasSocials ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Socials</Text>
              <View style={styles.socialsGrid}>
                {socials?.githubUrl ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.socialCard,
                      pressed && styles.socialCardPressed,
                    ]}
                    onPress={() => Linking.openURL(socials.githubUrl!)}
                  >
                    <Ionicons name="logo-github" size={22} color="#FFFFFF" />
                    <Text style={styles.socialCardLabel}>GitHub</Text>
                    <Ionicons
                      name="open-outline"
                      size={12}
                      color="rgba(255,255,255,0.3)"
                    />
                  </Pressable>
                ) : null}
                {socials?.linkedInUrl ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.socialCard,
                      pressed && styles.socialCardPressed,
                    ]}
                    onPress={() => Linking.openURL(socials.linkedInUrl!)}
                  >
                    <Ionicons name="logo-linkedin" size={22} color="#0A66C2" />
                    <Text style={styles.socialCardLabel}>LinkedIn</Text>
                    <Ionicons
                      name="open-outline"
                      size={12}
                      color="rgba(255,255,255,0.3)"
                    />
                  </Pressable>
                ) : null}
                {socials?.discordUsername ? (
                  <Pressable style={() => [styles.socialCard]}>
                    <Ionicons name="logo-discord" size={22} color="#5865F2" />
                    <Text style={styles.socialCardLabel}>Discord</Text>
                    <Text
                      style={{
                        marginLeft: "auto",
                        fontSize: 15,
                        fontWeight: 500,
                        color: "#FFFFFF",
                        opacity: 70,
                      }}
                    >
                      {" "}
                      {socials.discordUsername}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
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
                      size={160}
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

          {/* Sign Out */}
          <View style={styles.signOutSection}>
            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => [
                styles.signOutButton,
                pressed && styles.signOutButtonPressed,
              ]}
            >
              <Ionicons
                name="log-out-outline"
                size={18}
                color="rgba(255, 255, 255, 0.45)"
              />
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </View>
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

  heroSection: {
    position: "relative",
    height: BANNER_HEIGHT + AVATAR_SIZE / 2,
    marginBottom: 8,
  },
  banner: {
    height: BANNER_HEIGHT,
    width: "100%",
    overflow: "hidden",
    position: "relative",
  },
  bannerFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  decorCircle: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },

  topRightButtons: {
    position: "absolute",
    right: 16,
    zIndex: 10,
    flexDirection: "row",
    gap: 8,
  },
  headerActionButton: {
    position: "relative",
  },
  settingsButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#E04882",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: "#0A0A1A",
    zIndex: 10,
  },
  notifBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  avatarWrapper: {
    position: "absolute",
    bottom: 0,
    left: 24,
    zIndex: 10,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#0A0A1A",
  },
  avatarText: {
    fontSize: 38,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#34D399",
    borderWidth: 3,
    borderColor: "#0A0A1A",
  },

  nameSection: {
    paddingHorizontal: 24,
    gap: 3,
    marginBottom: 16,
  },
  name: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  handle: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.4)",
    fontWeight: "400",
  },
  universityBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 8,
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

  bioSection: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  bioText: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.65)",
    lineHeight: 22,
    fontWeight: "400",
  },

  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 24,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    paddingVertical: 18,
    marginBottom: 18,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.4)",
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },

  actionRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 10,
    marginBottom: 28,
  },
  editButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(108, 60, 224, 0.2)",
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(108, 60, 224, 0.3)",
  },
  editButtonPressed: {
    backgroundColor: "rgba(108, 60, 224, 0.35)",
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  shareButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  shareButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },

  contentArea: {
    paddingHorizontal: 24,
  },

  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.45)",
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

  socialsGrid: {
    gap: 8,
  },
  socialCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
  },
  socialCardPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  socialCardLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#FFFFFF",
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

  signOutSection: {
    marginTop: 8,
    marginBottom: 8,
    alignItems: "center",
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  signOutButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  signOutText: {
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.45)",
  },
});
