import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { GlassCard } from "~/components/GlassCard";
import { trpc } from "~/utils/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BANNER_HEIGHT = 200;
const AVATAR_SIZE = 100;

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

const GRADIENT_PAIRS: [string, string][] = [
  ["#2D1B69", "#11998E"],
  ["#4A1942", "#E04882"],
  ["#1A2980", "#26D0CE"],
  ["#2C3E50", "#FD746C"],
  ["#6C3CE0", "#E04882"],
];

function getGradientForId(id: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENT_PAIRS[Math.abs(hash) % GRADIENT_PAIRS.length]!;
}

export default function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [connectMessage, setConnectMessage] = useState("");
  const [showConnectInput, setShowConnectInput] = useState(false);

  const {
    data: user,
    isLoading,
    error,
  } = useQuery(trpc.user.getById.queryOptions({ id }));

  const requestConnectionMutation = useMutation(
    trpc.connection.requestConnection.mutationOptions(),
  );
  const acceptMutation = useMutation(
    trpc.connection.acceptConnection.mutationOptions(),
  );
  const cancelMutation = useMutation(
    trpc.connection.cancelOutgoingRequest.mutationOptions(),
  );
  const removeMutation = useMutation(
    trpc.connection.removeConnection.mutationOptions(),
  );

  const bannerGradient = getGradientForId(id);
  const displayName = user?.displayName ?? user?.name ?? "User";

  const enrolledUnits: EnrolledUnit[] = useMemo(() => {
    if (!user?.enrolledUnits) return [];
    if (Array.isArray(user.enrolledUnits))
      return user.enrolledUnits as EnrolledUnit[];
    return [];
  }, [user?.enrolledUnits]);

  const university = useMemo(
    () => getPrimaryUniversity(enrolledUnits),
    [enrolledUnits],
  );

  const socials = useMemo(() => {
    if (!user?.socials || typeof user.socials !== "object") return null;
    return user.socials as {
      githubUrl?: string;
      linkedInUrl?: string;
      discordUsername?: string;
    };
  }, [user?.socials]);

  const hasSocials = socials && Object.values(socials).some(Boolean);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: [["user", "getById"]] });
    queryClient.invalidateQueries({ queryKey: [["connection"]] });
    queryClient.invalidateQueries({ queryKey: [["user", "getMe"]] });
  };

  const handleConnect = () => {
    if (!showConnectInput) {
      setShowConnectInput(true);
      return;
    }
    requestConnectionMutation.mutate(
      { receiverId: id, message: connectMessage.trim() || undefined },
      {
        onSuccess: () => {
          invalidateAll();
          setShowConnectInput(false);
          setConnectMessage("");
        },
        onError: (err) => Alert.alert("Error", err.message),
      },
    );
  };

  const handleAccept = () => {
    if (!user?.pendingRequestId) return;
    acceptMutation.mutate(
      { requestId: user.pendingRequestId },
      {
        onSuccess: invalidateAll,
        onError: (err) => Alert.alert("Error", err.message),
      },
    );
  };

  const handleCancelRequest = () => {
    if (!user?.pendingRequestId) return;
    cancelMutation.mutate(
      { requestId: user.pendingRequestId },
      {
        onSuccess: invalidateAll,
        onError: (err) => Alert.alert("Error", err.message),
      },
    );
  };

  const handleRemoveConnection = () => {
    Alert.alert(
      "Remove Connection",
      `Are you sure you want to remove ${displayName} from your connections?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            removeMutation.mutate(
              { userId: id },
              {
                onSuccess: invalidateAll,
                onError: (err) => Alert.alert("Error", err.message),
              },
            ),
        },
      ],
    );
  };

  const handleMessage = () => {
    router.push(`/(app)/dm/${id}` as any);
  };

  const actionPending =
    requestConnectionMutation.isPending ||
    acceptMutation.isPending ||
    cancelMutation.isPending ||
    removeMutation.isPending;

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6C3CE0" />
      </View>
    );
  }

  if (error || !user) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color="rgba(255,255,255,0.2)"
        />
        <Text style={styles.errorText}>User not found</Text>
        <Pressable style={styles.errorButton} onPress={() => router.back()}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        <View style={styles.heroSection}>
          {user.bannerUrl ? (
            <View style={styles.bannerImageContainer}>
              <Image
                source={{ uri: user.bannerUrl }}
                style={styles.bannerImage}
              />
              <LinearGradient
                colors={["transparent", "rgba(10, 10, 26, 0.6)", "#0A0A1A"]}
                style={styles.bannerFade}
              />
            </View>
          ) : (
            <LinearGradient
              colors={bannerGradient}
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
          )}

          {/* Close button */}
          <Pressable
            style={[styles.closeButton, { top: insets.top + 12 }]}
            onPress={() => router.back()}
          >
            <GlassCard style={styles.closeButtonInner}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </GlassCard>
          </Pressable>

          {/* More options */}
          <Pressable
            style={[styles.moreButton, { top: insets.top + 12 }]}
            onPress={() => {
              if (user.connectionStatus === "connected") {
                Alert.alert(displayName, undefined, [
                  {
                    text: "Remove Connection",
                    style: "destructive",
                    onPress: handleRemoveConnection,
                  },
                  { text: "Cancel", style: "cancel" },
                ]);
              }
            }}
          >
            <GlassCard style={styles.moreButtonInner}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
            </GlassCard>
          </Pressable>

          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            {user.image ? (
              <Image source={{ uri: user.image }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={bannerGradient}
                style={styles.avatar}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.avatarText}>
                  {getInitials(displayName)}
                </Text>
              </LinearGradient>
            )}
          </View>
        </View>

        {/* Connection badge */}
        {user.connectionStatus === "connected" && (
          <View style={styles.connectedBadgeRow}>
            <View style={styles.connectedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#34D399" />
              <Text style={styles.connectedBadgeText}>Connected</Text>
            </View>
          </View>
        )}

        {/* Name + Handle */}
        <View style={styles.nameSection}>
          <Text style={styles.name}>{displayName}</Text>
          {user.slug ? <Text style={styles.handle}>@{user.slug}</Text> : null}
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
        {user.bio ? (
          <View style={styles.bioSection}>
            <Text style={styles.bioText}>{user.bio}</Text>
          </View>
        ) : null}

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.connectionsCount}</Text>
            <Text style={styles.statLabel}>connections</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user.eventsCount}</Text>
            <Text style={styles.statLabel}>events</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{enrolledUnits.length}</Text>
            <Text style={styles.statLabel}>courses</Text>
          </View>
        </View>

        {/* Connect message input */}
        {showConnectInput && user.connectionStatus === "none" && (
          <View style={styles.connectInputSection}>
            <GlassCard style={styles.connectInputCard}>
              <TextInput
                style={styles.connectInput}
                placeholder="Add a message (optional)..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={connectMessage}
                onChangeText={setConnectMessage}
                multiline
                autoFocus
              />
            </GlassCard>
          </View>
        )}

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
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {user.connectionStatus === "connected" ? (
          <View style={styles.bottomBarRow}>
            <Pressable
              onPress={handleMessage}
              style={({ pressed }) => [
                styles.messageButton,
                pressed && styles.messageButtonPressed,
              ]}
            >
              <LinearGradient
                colors={["#6C3CE0", "#E04882"]}
                style={styles.messageButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="chatbubble-outline" size={18} color="#FFFFFF" />
                <Text style={styles.messageButtonText}>Message</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : user.connectionStatus === "pending_sent" ? (
          <View style={styles.bottomBarRow}>
            <View style={styles.pendingInfo}>
              <Ionicons
                name="time-outline"
                size={16}
                color="rgba(255,255,255,0.5)"
              />
              <Text style={styles.pendingText}>Request Pending</Text>
            </View>
            <Pressable
              onPress={handleCancelRequest}
              disabled={actionPending}
              style={({ pressed }) => [
                styles.cancelButton,
                pressed && styles.cancelButtonPressed,
              ]}
            >
              {cancelMutation.isPending ? (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
              ) : (
                <Text style={styles.cancelButtonText}>Cancel</Text>
              )}
            </Pressable>
          </View>
        ) : user.connectionStatus === "pending_received" ? (
          <View style={styles.bottomBarRow}>
            <Pressable
              onPress={handleAccept}
              disabled={actionPending}
              style={styles.acceptButtonWrapper}
            >
              <LinearGradient
                colors={["#6C3CE0", "#E04882"]}
                style={styles.acceptButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {acceptMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={20}
                      color="#FFFFFF"
                    />
                    <Text style={styles.acceptButtonText}>
                      Accept Connection
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <View style={styles.bottomBarRow}>
            <Pressable
              onPress={handleConnect}
              disabled={actionPending}
              style={styles.connectButtonWrapper}
            >
              <LinearGradient
                colors={["#6C3CE0", "#E04882"]}
                style={styles.connectButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {requestConnectionMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name="person-add-outline"
                      size={20}
                      color="#FFFFFF"
                    />
                    <Text style={styles.connectButtonText}>
                      {showConnectInput ? "Send Request" : "Connect"}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </View>
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
    gap: 12,
  },
  errorText: {
    fontSize: 17,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },
  errorButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(108, 60, 224, 0.2)",
    marginTop: 4,
  },
  errorButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6C3CE0",
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
  bannerImageContainer: {
    height: BANNER_HEIGHT,
    width: "100%",
    position: "relative",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
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

  closeButton: {
    position: "absolute",
    left: 20,
    zIndex: 10,
  },
  closeButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  moreButton: {
    position: "absolute",
    right: 20,
    zIndex: 10,
  },
  moreButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
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
    fontSize: 34,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  connectedBadgeRow: {
    paddingHorizontal: 24,
    marginBottom: 4,
    alignItems: "flex-start",
  },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(52, 211, 153, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
  },
  connectedBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#34D399",
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
    marginBottom: 24,
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

  connectInputSection: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  connectInputCard: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  connectInput: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "400",
    padding: 0,
    minHeight: 48,
    textAlignVertical: "top",
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

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: "rgba(10, 10, 26, 0.95)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  bottomBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  connectButtonWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  connectButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  messageButton: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  messageButtonPressed: {
    opacity: 0.9,
  },
  messageButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  messageButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  pendingInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  pendingText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },
  cancelButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cancelButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },

  acceptButtonWrapper: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  acceptButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
