import { useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

let GlassView: React.ComponentType<any> | null = null;
try {
  GlassView = require("expo-glass-effect").GlassView;
} catch {
  GlassView = null;
}

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

const ORGANISER_GRADIENTS: [string, string][] = [
  ["#6C3CE0", "#E04882"],
  ["#4880E0", "#11998E"],
  ["#E04882", "#FD746C"],
  ["#11998E", "#26D0CE"],
];

export default function EventDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const {
    data: event,
    isLoading,
    error,
  } = useQuery(trpc.event.getById.queryOptions({ id }));

  const joinMutation = useMutation(trpc.event.joinById.mutationOptions());
  const leaveMutation = useMutation(trpc.event.leaveById.mutationOptions());
  const deleteMutation = useMutation(trpc.event.deleteById.mutationOptions());

  const isOrganiser = useMemo(
    () => event?.organisers.some((o) => o.id === userId) ?? false,
    [event, userId],
  );

  const isParticipant = useMemo(
    () => event?.participants.some((p) => p.id === userId) ?? false,
    [event, userId],
  );

  const handleJoinLeave = () => {
    if (!event) return;
    const mutation = isParticipant ? leaveMutation : joinMutation;
    mutation.mutate(
      { id: event.id },
      {
        onSuccess: () => queryClient.invalidateQueries(),
        onError: (err) =>
          Alert.alert("Error", err.message || "Something went wrong."),
      },
    );
  };

  const handleDelete = () => {
    if (!event) return;
    Alert.alert(
      "Delete Event",
      "Are you sure you want to delete this event? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            deleteMutation.mutate(event.id, {
              onSuccess: () => {
                queryClient.invalidateQueries();
                router.back();
              },
              onError: (err) =>
                Alert.alert(
                  "Error",
                  err.message || "Failed to delete event.",
                ),
            }),
        },
      ],
    );
  };

  const handleEdit = () => {
    if (!event) return;
    router.push(`/(app)/create-event?id=${event.id}` as any);
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6C3CE0" />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color="rgba(255,255,255,0.2)"
        />
        <Text style={styles.errorText}>Event not found</Text>
        <Pressable style={styles.errorButton} onPress={() => router.back()}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const actionPending =
    joinMutation.isPending ||
    leaveMutation.isPending ||
    deleteMutation.isPending;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {event.bannerUrl ? (
          <View style={styles.bannerContainer}>
            <Image
              source={{ uri: event.bannerUrl }}
              style={styles.bannerImage}
            />
            <LinearGradient
              colors={["transparent", "rgba(10, 10, 26, 0.8)", "#0A0A1A"]}
              style={styles.bannerGradientOverlay}
            />
          </View>
        ) : (
          <LinearGradient
            colors={["#2D1B69", "#11998E"]}
            style={styles.bannerFallback}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={[styles.decorCircle, { top: -30, right: 40 }]} />
            <View
              style={[
                styles.decorCircle,
                {
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  bottom: -30,
                  right: -20,
                  opacity: 0.08,
                },
              ]}
            />
            <LinearGradient
              colors={["transparent", "rgba(10, 10, 26, 0.8)", "#0A0A1A"]}
              style={styles.bannerGradientOverlay}
            />
          </LinearGradient>
        )}

        <Pressable
          style={[styles.closeButton, { top: insets.top + 12 }]}
          onPress={() => router.back()}
        >
          <GlassCard style={styles.closeButtonInner}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </GlassCard>
        </Pressable>

        <View style={styles.content}>
          <Text style={styles.title}>{event.title}</Text>

          <View style={styles.metaSection}>
            <GlassCard style={styles.metaCard}>
              <View style={styles.metaRow}>
                <View style={styles.metaIconBg}>
                  <Ionicons name="calendar" size={16} color="#6C3CE0" />
                </View>
                <View>
                  <Text style={styles.metaLabel}>Date</Text>
                  <Text style={styles.metaValue}>
                    {formatDate(event.date)}
                  </Text>
                </View>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaRow}>
                <View style={styles.metaIconBg}>
                  <Ionicons name="time" size={16} color="#6C3CE0" />
                </View>
                <View>
                  <Text style={styles.metaLabel}>Time</Text>
                  <Text style={styles.metaValue}>
                    {formatTime(event.date)}
                  </Text>
                </View>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaRow}>
                <View style={styles.metaIconBg}>
                  <Ionicons name="location" size={16} color="#6C3CE0" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.metaLabel}>Location</Text>
                  <Text style={styles.metaValue}>{event.location}</Text>
                </View>
              </View>
            </GlassCard>
          </View>

          {event.content ? (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.descriptionText}>{event.content}</Text>
            </View>
          ) : null}

          <View style={styles.organisersSection}>
            <Text style={styles.sectionTitle}>Organisers</Text>
            <View style={styles.organisersList}>
              {event.organisers.map((organiser, i) => (
                <View key={organiser.id} style={styles.organiserItem}>
                  <LinearGradient
                    colors={
                      ORGANISER_GRADIENTS[i % ORGANISER_GRADIENTS.length]!
                    }
                    style={styles.organiserAvatar}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.organiserInitials}>
                      {getInitials(organiser.name)}
                    </Text>
                  </LinearGradient>
                  <Text style={styles.organiserName}>{organiser.name}</Text>
                </View>
              ))}
            </View>
          </View>

          <GlassCard style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {event.participants.length}
              </Text>
              <Text style={styles.statLabel}>Attending</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {event.organisers.length}
              </Text>
              <Text style={styles.statLabel}>
                {event.organisers.length === 1 ? "Organiser" : "Organisers"}
              </Text>
            </View>
          </GlassCard>

          {isOrganiser && (
            <View style={styles.organiserActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.editButton,
                  pressed && styles.editButtonPressed,
                ]}
                onPress={handleEdit}
              >
                <Ionicons name="create-outline" size={18} color="#6C3CE0" />
                <Text style={styles.editButtonText}>Edit Event</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && styles.deleteButtonPressed,
                ]}
                onPress={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Ionicons name="trash-outline" size={18} color="#E04882" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {!isOrganiser && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            onPress={handleJoinLeave}
            disabled={actionPending}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && styles.actionButtonPressed,
              actionPending && styles.actionButtonDisabled,
            ]}
          >
            <LinearGradient
              colors={
                isParticipant
                  ? ["rgba(255,255,255,0.1)", "rgba(255,255,255,0.06)"]
                  : ["#6C3CE0", "#E04882"]
              }
              style={styles.actionButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {actionPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name={isParticipant ? "exit-outline" : "add-circle-outline"}
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.actionButtonText}>
                    {isParticipant ? "Leave Event" : "Join Event"}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      )}
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

  scrollView: {
    flex: 1,
  },

  bannerContainer: {
    height: 280,
    position: "relative",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  bannerFallback: {
    height: 280,
    position: "relative",
    overflow: "hidden",
  },
  bannerGradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  decorCircle: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },

  closeButton: {
    position: "absolute",
    right: 20,
    zIndex: 10,
  },
  closeButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  content: {
    paddingHorizontal: 24,
    marginTop: -40,
    gap: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    lineHeight: 36,
  },

  metaSection: {},
  metaCard: {
    borderRadius: 18,
    padding: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  metaIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(108, 60, 224, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  metaDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginHorizontal: 16,
  },

  descriptionSection: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(255,255,255,0.65)",
    fontWeight: "400",
  },

  organisersSection: {
    gap: 14,
  },
  organisersList: {
    flexDirection: "row",
    gap: 16,
  },
  organiserItem: {
    alignItems: "center",
    gap: 6,
  },
  organiserAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  organiserInitials: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  organiserName: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    maxWidth: 80,
  },

  statsRow: {
    flexDirection: "row",
    borderRadius: 18,
    padding: 20,
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
    fontWeight: "500",
    color: "rgba(255,255,255,0.4)",
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.1)",
  },

  organiserActions: {
    flexDirection: "row",
    gap: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(108, 60, 224, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(108, 60, 224, 0.2)",
  },
  editButtonPressed: {
    backgroundColor: "rgba(108, 60, 224, 0.2)",
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6C3CE0",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: "rgba(224, 72, 130, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(224, 72, 130, 0.15)",
  },
  deleteButtonPressed: {
    backgroundColor: "rgba(224, 72, 130, 0.2)",
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E04882",
  },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: "rgba(10, 10, 26, 0.92)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  actionButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  actionButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    borderRadius: 16,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  glassBase: {
    overflow: "hidden",
  },
  glassFallback: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
});
