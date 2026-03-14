import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { GlassCard } from "~/components/GlassCard";
import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_GRADIENTS: [string, string][] = [
  ["#6C3CE0", "#E04882"],
  ["#4880E0", "#11998E"],
  ["#E04882", "#FD746C"],
  ["#11998E", "#26D0CE"],
  ["#2D1B69", "#6C3CE0"],
  ["#4A1942", "#E04882"],
];

export default function EventDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const handleBackNavigation = useCallback(() => {
    if (from === "create-event") {
      router.replace("/(app)/(tabs)/events" as any);
      return;
    }
    router.back();
  }, [from, router]);

  const {
    data: event,
    isLoading,
    error,
  } = useQuery(trpc.event.getById.queryOptions({ id }));

  const joinMutation = useMutation(trpc.event.joinById.mutationOptions());
  const leaveMutation = useMutation(trpc.event.leaveById.mutationOptions());
  const deleteMutation = useMutation(trpc.event.deleteById.mutationOptions());

  const [showAttendees, setShowAttendees] = useState(false);
  const [showTicketConfirm, setShowTicketConfirm] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const qrRef = useRef<any>(null);

  const handleShareQr = useCallback(async () => {
    if (!event) return;
    try {
      await Share.share({
        message: `Join "${event.title}" on Relio! Scan the QR code or open: relio://event/${event.id}`,
      });
    } catch {
      // user cancelled share
    }
  }, [event]);

  const handlePrintQr = useCallback(() => {
    if (!event || !qrRef.current) return;
    qrRef.current.toDataURL((base64: string) => {
      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #fff; }
              .card { text-align: center; padding: 48px 32px; max-width: 400px; }
              .brand { font-size: 14px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #6C3CE0; margin-bottom: 24px; }
              .title { font-size: 26px; font-weight: 800; color: #0A0A1A; margin-bottom: 8px; }
              .date { font-size: 14px; color: #666; margin-bottom: 32px; }
              .qr { margin: 0 auto 32px; }
              .qr img { width: 240px; height: 240px; }
              .hint { font-size: 13px; color: #999; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="brand">Relio</div>
              <div class="title">${event.title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
              <div class="date">${new Date(event.date).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${event.location.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
              <div class="qr"><img src="data:image/png;base64,${base64}" /></div>
              <div class="hint">Scan this QR code with Relio to join the event</div>
            </div>
          </body>
        </html>
      `;
      Print.printAsync({ html }).catch(() => {});
    });
  }, [event]);

  const isOrganiser = useMemo(
    () => event?.organisers.some((o) => o.id === userId) ?? false,
    [event, userId],
  );

  const isParticipant = useMemo(
    () => event?.participants.some((p) => p.id === userId) ?? false,
    [event, userId],
  );

  const performJoin = () => {
    if (!event) return;
    joinMutation.mutate(
      { id: event.id },
      {
        onSuccess: () => queryClient.invalidateQueries(),
        onError: (err) =>
          Alert.alert("Error", err.message || "Something went wrong."),
      },
    );
  };

  const handleJoinLeave = () => {
    if (!event) return;
    if (isParticipant) {
      leaveMutation.mutate(
        { id: event.id },
        {
          onSuccess: () => queryClient.invalidateQueries(),
          onError: (err) =>
            Alert.alert("Error", err.message || "Something went wrong."),
        },
      );
      return;
    }
    if (event.ticketUrl) {
      setShowTicketConfirm(true);
      return;
    }
    performJoin();
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
                handleBackNavigation();
              },
              onError: (err) =>
                Alert.alert("Error", err.message || "Failed to delete event."),
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
        <Pressable style={styles.errorButton} onPress={handleBackNavigation}>
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
          onPress={handleBackNavigation}
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
                  <Text style={styles.metaValue}>{formatDate(event.date)}</Text>
                </View>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaRow}>
                <View style={styles.metaIconBg}>
                  <Ionicons name="time" size={16} color="#6C3CE0" />
                </View>
                <View>
                  <Text style={styles.metaLabel}>Time</Text>
                  <Text style={styles.metaValue}>{formatTime(event.date)}</Text>
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
                <Pressable
                  key={organiser.id}
                  style={styles.organiserItem}
                  onPress={() => {
                    if (organiser.id !== userId) {
                      router.push(`/(app)/user/${organiser.id}` as any);
                    }
                  }}
                >
                  <LinearGradient
                    colors={AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]!}
                    style={styles.organiserAvatar}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.organiserInitials}>
                      {getInitials(organiser.name)}
                    </Text>
                  </LinearGradient>
                  <Text style={styles.organiserName}>{organiser.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <GlassCard style={styles.statsRow}>
            <Pressable
              style={styles.statItem}
              onPress={() => setShowAttendees(true)}
            >
              <Text style={styles.statValue}>{event.participants.length}</Text>
              <View style={styles.statLabelRow}>
                <Text style={styles.statLabel}>Attending</Text>
                <Ionicons
                  name="chevron-forward"
                  size={12}
                  color="rgba(255,255,255,0.3)"
                />
              </View>
            </Pressable>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{event.organisers.length}</Text>
              <Text style={styles.statLabel}>
                {event.organisers.length === 1 ? "Organiser" : "Organisers"}
              </Text>
            </View>
          </GlassCard>

          {(isOrganiser || isParticipant) && (
            <GlassCard style={styles.actionsCard}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed && styles.actionRowPressed,
                ]}
                onPress={() =>
                  router.push(`/(app)/event-chat/${event.id}` as any)
                }
              >
                <View style={[styles.actionIconBg, styles.actionIconPurple]}>
                  <Ionicons name="chatbubbles" size={16} color="#6C3CE0" />
                </View>
                <Text style={styles.actionRowLabel}>Event Chat</Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color="rgba(255,255,255,0.25)"
                />
              </Pressable>

              {isOrganiser && (
                <>
                  <View style={styles.actionRowDivider} />
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionRow,
                      pressed && styles.actionRowPressed,
                    ]}
                    onPress={() => setShowQrModal(true)}
                  >
                    <View
                      style={[styles.actionIconBg, styles.actionIconPurple]}
                    >
                      <Ionicons name="qr-code" size={16} color="#6C3CE0" />
                    </View>
                    <Text style={styles.actionRowLabel}>Event QR Code</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="rgba(255,255,255,0.25)"
                    />
                  </Pressable>
                  <View style={styles.actionRowDivider} />
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionRow,
                      pressed && styles.actionRowPressed,
                    ]}
                    onPress={handleEdit}
                  >
                    <View
                      style={[styles.actionIconBg, styles.actionIconPurple]}
                    >
                      <Ionicons name="create" size={16} color="#6C3CE0" />
                    </View>
                    <Text style={styles.actionRowLabel}>Edit Event</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="rgba(255,255,255,0.25)"
                    />
                  </Pressable>
                  <View style={styles.actionRowDivider} />
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionRow,
                      pressed && styles.actionRowPressed,
                    ]}
                    onPress={handleDelete}
                    disabled={deleteMutation.isPending}
                  >
                    <View style={[styles.actionIconBg, styles.actionIconRed]}>
                      <Ionicons name="trash" size={15} color="#E04882" />
                    </View>
                    <Text style={styles.actionRowLabelDanger}>
                      Delete Event
                    </Text>
                  </Pressable>
                </>
              )}
            </GlassCard>
          )}
        </View>
      </ScrollView>

      {!isOrganiser && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          {event.ticketUrl && !isParticipant && (
            <Pressable
              style={styles.ticketLinkButton}
              onPress={() => Linking.openURL(event.ticketUrl!)}
            >
              <Ionicons name="ticket-outline" size={16} color="#6C3CE0" />
              <Text style={styles.ticketLinkText}>Get Tickets</Text>
              <Ionicons
                name="open-outline"
                size={14}
                color="rgba(108, 60, 224, 0.6)"
              />
            </Pressable>
          )}
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

      <Modal
        visible={showAttendees}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAttendees(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Attending</Text>
            <Pressable
              onPress={() => setShowAttendees(false)}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
          >
            {event?.participants.map((p, i) => (
              <Pressable
                key={p.id}
                style={styles.attendeeRow}
                onPress={() => {
                  if (p.id !== userId) {
                    setShowAttendees(false);
                    router.push(`/(app)/user/${p.id}` as any);
                  }
                }}
              >
                {p.image ? (
                  <Image
                    source={{ uri: p.image }}
                    style={styles.attendeeAvatar}
                  />
                ) : (
                  <LinearGradient
                    colors={AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]!}
                    style={styles.attendeeAvatar}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.attendeeInitials}>
                      {getInitials(p.name)}
                    </Text>
                  </LinearGradient>
                )}
                <Text style={styles.attendeeName}>{p.name}</Text>
                {p.id === userId && (
                  <View style={styles.youBadge}>
                    <Text style={styles.youBadgeText}>You</Text>
                  </View>
                )}
              </Pressable>
            ))}
            {event?.participants.length === 0 && (
              <View style={styles.emptyAttendees}>
                <Ionicons
                  name="people-outline"
                  size={40}
                  color="rgba(255,255,255,0.15)"
                />
                <Text style={styles.emptyAttendeesText}>
                  No one has joined yet
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showTicketConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTicketConfirm(false)}
      >
        <Pressable
          style={styles.confirmOverlay}
          onPress={() => setShowTicketConfirm(false)}
        >
          <Pressable style={styles.confirmCard}>
            <View style={styles.confirmIconCircle}>
              <Ionicons name="ticket-outline" size={28} color="#6C3CE0" />
            </View>
            <Text style={styles.confirmTitle}>Get Your Ticket First</Text>
            <Text style={styles.confirmMessage}>
              Make sure you get a ticket from the event organiser before
              joining.
            </Text>
            <Pressable
              style={styles.confirmTicketButton}
              onPress={() => {
                if (event?.ticketUrl) Linking.openURL(event.ticketUrl);
              }}
            >
              <Ionicons name="open-outline" size={16} color="#6C3CE0" />
              <Text style={styles.confirmTicketText}>Get Tickets</Text>
            </Pressable>
            <View style={styles.confirmActions}>
              <Pressable
                style={styles.confirmCancel}
                onPress={() => setShowTicketConfirm(false)}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.confirmJoin}
                onPress={() => {
                  setShowTicketConfirm(false);
                  performJoin();
                }}
              >
                <LinearGradient
                  colors={["#6C3CE0", "#E04882"]}
                  style={styles.confirmJoinGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.confirmJoinText}>I Have My Ticket</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showQrModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQrModal(false)}
      >
        <Pressable
          style={styles.qrOverlay}
          onPress={() => setShowQrModal(false)}
        >
          <Pressable style={styles.qrModalCard}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>Event QR Code</Text>
              <Pressable
                onPress={() => setShowQrModal(false)}
                style={styles.qrModalClose}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color="rgba(255,255,255,0.6)"
                />
              </Pressable>
            </View>

            <Text style={styles.qrEventName}>{event?.title}</Text>

            <View style={styles.qrCodeContainer}>
              <View style={styles.qrCodeBackground}>
                {event?.id && (
                  <QRCode
                    getRef={(c) => (qrRef.current = c)}
                    value={`relio://event/${event.id}`}
                    size={200}
                    backgroundColor="#FFFFFF"
                    color="#0A0A1A"
                  />
                )}
              </View>
            </View>

            <Text style={styles.qrModalHint}>
              Attendees can scan this to instantly join
            </Text>

            <View style={styles.qrActionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.qrShareButton,
                  pressed && styles.qrShareButtonPressed,
                ]}
                onPress={handleShareQr}
              >
                <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                <Text style={styles.qrShareButtonText}>Share</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.qrPrintButton,
                  pressed && styles.qrPrintButtonPressed,
                ]}
                onPress={handlePrintQr}
              >
                <Ionicons name="print-outline" size={18} color="#6C3CE0" />
                <Text style={styles.qrPrintButtonText}>Print</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  } as const,
  statLabelRow: {
    flexDirection: "row",
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

  actionsCard: {
    borderRadius: 18,
    padding: 4,
    overflow: "hidden",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 14,
    borderRadius: 14,
  },
  actionRowPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  actionIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  actionIconPurple: {
    backgroundColor: "rgba(108, 60, 224, 0.12)",
  },
  actionIconRed: {
    backgroundColor: "rgba(224, 72, 130, 0.12)",
  },
  actionRowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  actionRowLabelDanger: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#E04882",
  },
  actionRowDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginHorizontal: 14,
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

  ticketLinkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: "rgba(108, 60, 224, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(108, 60, 224, 0.15)",
  },
  ticketLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6C3CE0",
  },

  modalContainer: {
    flex: 1,
    backgroundColor: "#0A0A1A",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  attendeeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  attendeeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  attendeeInitials: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  attendeeName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  youBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: "rgba(108, 60, 224, 0.15)",
  },
  youBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6C3CE0",
  },
  emptyAttendees: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyAttendeesText: {
    fontSize: 15,
    fontWeight: "500",
    color: "rgba(255,255,255,0.35)",
  },

  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  confirmCard: {
    width: "100%",
    backgroundColor: "#1A1A2E",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  confirmIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(108, 60, 224, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  confirmMessage: {
    fontSize: 14,
    fontWeight: "400",
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    lineHeight: 20,
  },
  confirmTicketButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(108, 60, 224, 0.12)",
    marginVertical: 4,
  },
  confirmTicketText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6C3CE0",
  },
  confirmActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    width: "100%",
  },
  confirmCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },
  confirmJoin: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  confirmJoinGradient: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  confirmJoinText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  qrOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  qrModalCard: {
    width: "100%",
    backgroundColor: "#1A1A2E",
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  qrModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 8,
  },
  qrModalTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  qrModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  qrEventName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 24,
    letterSpacing: -0.3,
  },
  qrCodeContainer: {
    borderRadius: 20,
    padding: 4,
    backgroundColor: "rgba(108, 60, 224, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(108, 60, 224, 0.15)",
    marginBottom: 20,
  },
  qrCodeBackground: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 16,
  },
  qrModalHint: {
    fontSize: 14,
    fontWeight: "400",
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    marginBottom: 20,
  },
  qrActionRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  qrShareButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: "#6C3CE0",
  },
  qrShareButtonPressed: {
    backgroundColor: "#5A2FCB",
  },
  qrShareButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  qrPrintButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: "rgba(108, 60, 224, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(108, 60, 224, 0.2)",
  },
  qrPrintButtonPressed: {
    backgroundColor: "rgba(108, 60, 224, 0.2)",
  },
  qrPrintButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6C3CE0",
  },
});
