import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import FloatingOrbs from "~/components/FloatingOrbs";
import { GlassCard } from "~/components/GlassCard";
import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
  Dimensions.get("window");

const CAROUSEL_GRADIENTS: [string, string][] = [
  ["#2D1B69", "#11998E"],
  ["#4A1942", "#E04882"],
  ["#1A2980", "#26D0CE"],
  ["#2C3E50", "#FD746C"],
];

const AVATAR_GRADIENTS: [string, string][] = [
  ["#6C3CE0", "#E04882"],
  ["#4880E0", "#11998E"],
  ["#E04882", "#FD746C"],
  ["#11998E", "#26D0CE"],
  ["#2D1B69", "#6C3CE0"],
];

const SUGGESTED_GRADIENTS: [string, string][] = [
  ["#0F2027", "#2C5364"],
  ["#2D1B69", "#4A1942"],
  ["#1A2980", "#4880E0"],
  ["#2C3E50", "#3498DB"],
];

function formatRelativeDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Past";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 14) return "In 1 week";
  if (diffDays < 30) return `In ${Math.floor(diffDays / 7)} weeks`;
  if (diffDays < 60) return "In 1 month";
  return `In ${Math.floor(diffDays / 30)} months`;
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function DotIndicator({
  count,
  activeIndex,
}: {
  count: number;
  activeIndex: number;
}) {
  return (
    <View style={styles.dotContainer}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === activeIndex ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );
}

const FLOAT_SIZES = [44, 52, 64, 72, 80] as const;
const AVATAR_BORDER_COLORS = [
  "#6C3CE0",
  "#E04882",
  "#11998E",
  "#4880E0",
  "#FD746C",
  "#26D0CE",
];
const easeInOutSin = Easing.inOut(Easing.sin);

interface PlacedAvatar {
  x: number;
  y: number;
  size: number;
  user: { id: string; name: string; image: string | null; checkedInAt: Date };
  borderColor: string;
  driftY: number;
  driftX: number;
  durationY: number;
  durationX: number;
  delay: number;
}

function computeAvatarLayout(
  users: { id: string; name: string; image: string | null; checkedInAt: Date }[],
  screenW: number,
  screenH: number,
  topInset: number,
): PlacedAvatar[] {
  const padding = 24;
  const topOffset = topInset + 120;
  const bottomOffset = 200;
  const usableW = screenW - padding * 2;
  const usableH = screenH - topOffset - bottomOffset;
  const maxVisible = 15;
  const visible = users.slice(0, maxVisible);

  const placed: PlacedAvatar[] = [];

  for (let i = 0; i < visible.length; i++) {
    const user = visible[i]!;
    const sizeIdx = Math.min(i, FLOAT_SIZES.length - 1);
    const size = FLOAT_SIZES[i < 3 ? 4 - i : Math.max(0, sizeIdx % FLOAT_SIZES.length)]!;

    let bestX = 0;
    let bestY = 0;
    let bestMinDist = -1;

    for (let attempt = 0; attempt < 50; attempt++) {
      const seed = hashCode(user.id + attempt.toString());
      const x = padding + (Math.abs(seed) % Math.max(1, usableW - size));
      const y = topOffset + (Math.abs(hashCode(user.id + "y" + attempt)) % Math.max(1, usableH - size));

      let minDist = Infinity;
      let overlaps = false;
      for (const p of placed) {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const pcx = p.x + p.size / 2;
        const pcy = p.y + p.size / 2;
        const dist = Math.sqrt((cx - pcx) ** 2 + (cy - pcy) ** 2);
        const minRequired = (size / 2 + p.size / 2) + 8;
        if (dist < minRequired) {
          overlaps = true;
          break;
        }
        minDist = Math.min(minDist, dist);
      }

      if (!overlaps && (placed.length === 0 || minDist > bestMinDist)) {
        bestX = x;
        bestY = y;
        bestMinDist = minDist;
        if (!overlaps) break;
      }
    }

    placed.push({
      x: bestX,
      y: bestY,
      size,
      user,
      borderColor: AVATAR_BORDER_COLORS[i % AVATAR_BORDER_COLORS.length]!,
      driftY: 8 + (i % 5) * 3,
      driftX: 5 + (i % 4) * 2,
      durationY: 3000 + (i % 4) * 800,
      durationX: 3500 + (i % 3) * 900,
      delay: i * 150,
    });
  }

  return placed;
}

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const chr = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash;
}

function FloatingAvatar({
  avatar,
  onPress,
}: {
  avatar: PlacedAvatar;
  onPress: () => void;
}) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(avatar.delay, withTiming(1, { duration: 600 }));
    scale.value = withDelay(
      avatar.delay,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.back(1.5)) }),
    );

    translateY.value = withDelay(
      avatar.delay + 400,
      withRepeat(
        withSequence(
          withTiming(-avatar.driftY, { duration: avatar.durationY, easing: easeInOutSin }),
          withTiming(avatar.driftY, { duration: avatar.durationY, easing: easeInOutSin }),
          withTiming(0, { duration: avatar.durationY, easing: easeInOutSin }),
        ),
        -1,
        false,
      ),
    );

    translateX.value = withDelay(
      avatar.delay + 400,
      withRepeat(
        withSequence(
          withTiming(avatar.driftX, { duration: avatar.durationX, easing: easeInOutSin }),
          withTiming(-avatar.driftX, { duration: avatar.durationX, easing: easeInOutSin }),
          withTiming(0, { duration: avatar.durationX, easing: easeInOutSin }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  const gradientIdx = Math.abs(hashCode(avatar.user.id)) % AVATAR_GRADIENTS.length;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: avatar.x,
          top: avatar.y,
          width: avatar.size,
          height: avatar.size,
        },
        animStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          liveStyles.avatarCircle,
          {
            width: avatar.size,
            height: avatar.size,
            borderRadius: avatar.size / 2,
            borderColor: avatar.borderColor,
            shadowColor: avatar.borderColor,
          },
          pressed && { transform: [{ scale: 0.92 }] },
        ]}
      >
        {avatar.user.image ? (
          <Image
            source={{ uri: avatar.user.image }}
            style={{
              width: avatar.size - 4,
              height: avatar.size - 4,
              borderRadius: (avatar.size - 4) / 2,
            }}
          />
        ) : (
          <LinearGradient
            colors={AVATAR_GRADIENTS[gradientIdx]!}
            style={{
              width: avatar.size - 4,
              height: avatar.size - 4,
              borderRadius: (avatar.size - 4) / 2,
              justifyContent: "center",
              alignItems: "center",
            }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text
              style={{
                fontSize: avatar.size * 0.32,
                fontWeight: "700",
                color: "#FFFFFF",
              }}
            >
              {getInitials(avatar.user.name)}
            </Text>
          </LinearGradient>
        )}
      </Pressable>
    </Animated.View>
  );
}

const MemoFloatingAvatar = memo(FloatingAvatar);

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const [activeEventIndex, setActiveEventIndex] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState<{
    reason: string;
    signals: {
      type: "connections" | "unit_peers" | "popularity" | "happening_soon";
      label: string;
      icon: string;
      names?: string[];
    }[];
  } | null>(null);

  const {
    data: myUpcomingEvents = [],
    refetch: refetchMyUpcomingEvents,
    isRefetching: isRefetchingMyUpcomingEvents,
  } = useQuery(trpc.event.getMyUpcomingEvents.queryOptions());

  const {
    data: suggestedEvents = [],
    refetch: refetchSuggestedEvents,
    isRefetching: isRefetchingSuggestedEvents,
  } = useQuery(trpc.event.getSuggestedEvents.queryOptions());

  const {
    data: peopleToConnect = [],
    refetch: refetchPeopleToConnect,
    isRefetching: isRefetchingPeopleToConnect,
  } = useQuery(trpc.user.getReconnectPeople.queryOptions());

  const { data: activeCheckIn } = useQuery({
    ...trpc.event.getMyActiveCheckIn.queryOptions(),
    refetchInterval: 30000,
  });

  const activeEventId = (activeCheckIn as any)?.event?.id as string | undefined;

  const { data: checkedInUsers = [] } = useQuery({
    ...trpc.event.getCheckedInUsers.queryOptions({ eventId: activeEventId! }),
    enabled: !!activeEventId,
    refetchInterval: 10000,
  });

  const checkOutMutation = useMutation(
    (trpc as any).event.checkOut.mutationOptions(),
  );

  const handleCheckOut = useCallback(() => {
    if (!activeEventId) return;
    Alert.alert(
      "Leave Event",
      "Are you sure you want to check out? You'll need to scan the QR code again to check back in.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => {
            checkOutMutation.mutate(
              { eventId: activeEventId },
              { onSuccess: () => queryClient.invalidateQueries() },
            );
          },
        },
      ],
    );
  }, [activeEventId, checkOutMutation, queryClient]);

  const showTakeover = !!activeCheckIn;

  const avatarLayout = useMemo(() => {
    if (!showTakeover || checkedInUsers.length === 0) return [];
    return computeAvatarLayout(
      checkedInUsers as { id: string; name: string; image: string | null; checkedInAt: Date }[],
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
      insets.top,
    );
  }, [showTakeover, checkedInUsers, insets.top]);

  const { data: selectedEvent, isLoading: isLoadingSelected } = useQuery({
    ...trpc.event.getById.queryOptions({ id: selectedEventId! }),
    enabled: !!selectedEventId,
  });

  const joinMutation = useMutation(trpc.event.joinById.mutationOptions());
  const leaveMutation = useMutation(trpc.event.leaveById.mutationOptions());

  const isParticipant = useMemo(
    () => selectedEvent?.participants.some((p) => p.id === userId) ?? false,
    [selectedEvent, userId],
  );

  const isOrganiser = useMemo(
    () => selectedEvent?.organisers.some((o) => o.id === userId) ?? false,
    [selectedEvent, userId],
  );

  const handleJoinLeave = () => {
    if (!selectedEvent) return;
    const mutation = isParticipant ? leaveMutation : joinMutation;
    mutation.mutate(
      { id: selectedEvent.id },
      {
        onSuccess: () => queryClient.invalidateQueries(),
        onError: (err) =>
          Alert.alert("Error", err.message || "Something went wrong."),
      },
    );
  };

  const firstName = session?.user?.name?.split(" ")[0] ?? "there";
  const fullName = session?.user?.name ?? "User";

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const handleCarouselScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      setActiveEventIndex(index);
    },
    [],
  );

  const handleRefresh = useCallback(() => {
    return Promise.all([
      refetchMyUpcomingEvents(),
      refetchSuggestedEvents(),
      refetchPeopleToConnect(),
    ]);
  }, [refetchMyUpcomingEvents, refetchPeopleToConnect, refetchSuggestedEvents]);

  const formatFullDate = (date: Date | string) => {
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

  const actionPending = joinMutation.isPending || leaveMutation.isPending;
  const isRefetchingHome =
    isRefetchingMyUpcomingEvents ||
    isRefetchingSuggestedEvents ||
    isRefetchingPeopleToConnect;

  if (showTakeover && activeCheckIn) {
    const ev = activeCheckIn.event;
    const remaining = checkedInUsers.length > 15 ? checkedInUsers.length - 15 : 0;

    return (
      <View style={liveStyles.container}>
        <LinearGradient
          colors={["#0A0A1A", "#0D0D20", "#0A0A1A"]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />

        {avatarLayout.map((avatar) => (
          <MemoFloatingAvatar
            key={avatar.user.id}
            avatar={avatar}
            onPress={() => {
              if (avatar.user.id !== userId) {
                router.push(`/(app)/user/${avatar.user.id}` as any);
              }
            }}
          />
        ))}

        <View
          style={[liveStyles.topSection, { paddingTop: insets.top + 12 }]}
          pointerEvents="box-none"
        >
          <Pressable
            style={liveStyles.exitPill}
            onPress={handleCheckOut}
          >
            <Ionicons name="exit-outline" size={14} color="rgba(224, 72, 130, 0.8)" />
            <Text style={liveStyles.exitPillText}>Leave Event</Text>
          </Pressable>

          <View style={liveStyles.eventHeader}>
            <View style={liveStyles.liveIndicator}>
              <View style={liveStyles.liveDot} />
              <Text style={liveStyles.liveText}>LIVE</Text>
            </View>
            <Text style={liveStyles.eventTitle} numberOfLines={2}>
              {ev.title}
            </Text>
            <View style={liveStyles.eventMetaRow}>
              <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.5)" />
              <Text style={liveStyles.eventMetaText}>{ev.location}</Text>
            </View>
          </View>
        </View>

        {checkedInUsers.length === 0 && (
          <View style={liveStyles.emptyCenter}>
            <View style={liveStyles.emptyIcon}>
              <Ionicons name="scan-outline" size={36} color="rgba(108, 60, 224, 0.5)" />
            </View>
            <Text style={liveStyles.emptyTitle}>No one checked in yet</Text>
            <Text style={liveStyles.emptyHint}>
              Attendees will appear here when they scan the check-in QR code
            </Text>
          </View>
        )}

        <View
          style={[liveStyles.bottomSection, { paddingBottom: insets.bottom + 16 }]}
          pointerEvents="box-none"
        >
          <GlassCard style={liveStyles.bottomCard}>
            <View style={liveStyles.bottomCardTop}>
              <View style={liveStyles.peopleCountRow}>
                <View style={liveStyles.peopleCountIcon}>
                  <Ionicons name="people" size={16} color="#11998E" />
                </View>
                <Text style={liveStyles.peopleCountText}>
                  {checkedInUsers.length} {checkedInUsers.length === 1 ? "person" : "people"} here
                </Text>
                {remaining > 0 && (
                  <Text style={liveStyles.moreText}>+{remaining} more</Text>
                )}
              </View>
            </View>

            <View style={liveStyles.bottomActions}>
              <Pressable
                style={({ pressed }) => [
                  liveStyles.chatButton,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => router.push(`/(app)/event-chat/${ev.id}` as any)}
              >
                <Ionicons name="chatbubbles" size={16} color="#6C3CE0" />
                <Text style={liveStyles.chatButtonText}>Event Chat</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  liveStyles.viewButton,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => router.push(`/(app)/event/${ev.id}` as any)}
              >
                <Text style={liveStyles.viewButtonText}>View Event</Text>
                <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0A1A", "#10101F", "#0A0A1A"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <FloatingOrbs opacity={0.5} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetchingHome}
            onRefresh={handleRefresh}
            tintColor="#6C3CE0"
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{firstName}</Text>
          </View>
          <Pressable onPress={() => router.push("/(app)/profile" as any)}>
            <GlassCard style={styles.avatarContainer}>
              {session?.user?.image ? (
                <Image
                  source={{ uri: session.user.image }}
                  style={styles.avatar}
                />
              ) : (
                <Text style={styles.avatarText}>{getInitials(fullName)}</Text>
              )}
            </GlassCard>
          </Pressable>
        </View>

        {myUpcomingEvents.length > 0 ? (
          <View style={styles.carouselSection}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleCarouselScroll}
            >
              {myUpcomingEvents.map((event, index) => (
                <View key={event.id} style={styles.carouselPage}>
                  <Pressable
                    style={styles.carouselCard}
                    onPress={() =>
                      router.push(`/(app)/event/${event.id}` as any)
                    }
                  >
                    {event.bannerUrl ? (
                      <View style={styles.carouselGradient}>
                        <Image
                          source={{ uri: event.bannerUrl }}
                          style={styles.carouselBannerImage}
                        />
                        <LinearGradient
                          colors={[
                            "rgba(10, 10, 26, 0.2)",
                            "rgba(10, 10, 26, 0.7)",
                            "rgba(10, 10, 26, 0.9)",
                          ]}
                          style={styles.carouselImageOverlay}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        />
                        <View
                          style={[
                            styles.carouselContent,
                            styles.carouselContentPadding,
                          ]}
                        >
                          <View style={styles.carouselTopRow}>
                            <Text style={styles.carouselLabel}>Upcoming</Text>
                            <View style={styles.carouselTimeBadge}>
                              <Text style={styles.carouselTimeText}>
                                {formatRelativeDate(event.date)}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.carouselBottom}>
                            <Text style={styles.carouselTitle}>
                              {event.title}
                            </Text>
                            <Text style={styles.carouselMeta}>
                              {event.location}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <LinearGradient
                        colors={
                          CAROUSEL_GRADIENTS[index % CAROUSEL_GRADIENTS.length]!
                        }
                        style={styles.carouselGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <View
                          style={[styles.decorCircle, { top: -30, right: 40 }]}
                        />
                        <View
                          style={[
                            styles.decorCircle,
                            {
                              width: 120,
                              height: 120,
                              borderRadius: 60,
                              bottom: -40,
                              right: -20,
                              opacity: 0.08,
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.decorCircle,
                            {
                              width: 60,
                              height: 60,
                              borderRadius: 30,
                              top: 20,
                              right: -10,
                              opacity: 0.12,
                            },
                          ]}
                        />
                        <View
                          style={[
                            styles.carouselContent,
                            styles.carouselContentPadding,
                          ]}
                        >
                          <View style={styles.carouselTopRow}>
                            <Text style={styles.carouselLabel}>Upcoming</Text>
                            <View style={styles.carouselTimeBadge}>
                              <Text style={styles.carouselTimeText}>
                                {formatRelativeDate(event.date)}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.carouselBottom}>
                            <Text style={styles.carouselTitle}>
                              {event.title}
                            </Text>
                            <Text style={styles.carouselMeta}>
                              {event.location}
                            </Text>
                          </View>
                        </View>
                      </LinearGradient>
                    )}
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <DotIndicator
              count={myUpcomingEvents.length}
              activeIndex={activeEventIndex}
            />
          </View>
        ) : (
          <View style={styles.emptyCarousel}>
            <Text style={styles.emptyCarouselText}>No upcoming events yet</Text>
            <Text style={styles.emptyCarouselHint}>
              Join events from the Events tab to see them here
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <SectionHeader title="People you recently missed" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {peopleToConnect.map((person, index) => (
              <Pressable
                key={person.id}
                style={styles.personCard}
                onPress={() => router.push(`/(app)/user/${person.id}` as any)}
              >
                {(person.image ?? person.avatarUrl) ? (
                  <Image
                    source={{ uri: (person.image ?? person.avatarUrl)! }}
                    style={styles.personAvatar}
                  />
                ) : (
                  <LinearGradient
                    colors={AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]!}
                    style={styles.personAvatar}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.personInitials}>
                      {getInitials(person.name)}
                    </Text>
                  </LinearGradient>
                )}
                <Text style={styles.personName} numberOfLines={1}>
                  {person.displayName ?? person.name}
                </Text>
                <Text style={styles.personMetAt} numberOfLines={1}>
                  Met at {person.metAt}
                </Text>
              </Pressable>
            ))}
            {peopleToConnect.length === 0 && (
              <View style={styles.noPeopleCard}>
                <Text style={styles.noPeopleText}>
                  No recent people to reconnect with
                </Text>
              </View>
            )}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Events you may be interested in" />
          {suggestedEvents.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {suggestedEvents.map((event, index) => (
                <Pressable
                  key={event.id}
                  style={styles.suggestedCard}
                  onPress={() => {
                    setSelectedEventId(event.id);
                    setSelectedRecommendation({
                      reason: event.reason,
                      signals: event.recommendationSignals,
                    });
                  }}
                >
                  {event.bannerUrl ? (
                    <Image
                      source={{ uri: event.bannerUrl }}
                      style={styles.suggestedImage}
                    />
                  ) : (
                    <LinearGradient
                      colors={
                        SUGGESTED_GRADIENTS[index % SUGGESTED_GRADIENTS.length]!
                      }
                      style={styles.suggestedImage}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <View
                        style={[
                          styles.decorCircle,
                          {
                            width: 50,
                            height: 50,
                            borderRadius: 25,
                            top: 15,
                            right: 15,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.decorCircle,
                          {
                            width: 70,
                            height: 70,
                            borderRadius: 35,
                            bottom: -20,
                            left: 20,
                            opacity: 0.06,
                          },
                        ]}
                      />
                    </LinearGradient>
                  )}
                  <View style={styles.suggestedInfo}>
                    {event.reason ? (
                      <View style={styles.suggestedReasonRow}>
                        <Ionicons
                          name={
                            event.connectionsGoingCount > 0
                              ? "people"
                              : "school"
                          }
                          size={11}
                          color="#6C3CE0"
                        />
                        <Text
                          style={styles.suggestedReasonText}
                          numberOfLines={1}
                        >
                          {event.reason}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.suggestedOrganiser}>
                        {event.organisers.map((o: any) => o.name).join(", ")}
                      </Text>
                    )}
                    <Text style={styles.suggestedTitle} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <View style={styles.suggestedMeta}>
                      <Text style={styles.suggestedDate}>
                        {formatDate(event.date)}
                      </Text>
                      <View style={styles.suggestedDot} />
                      <Text style={styles.suggestedAttendees}>
                        {event.participants.length} going
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.suggestedEmpty}>
              <Ionicons
                name="sparkles-outline"
                size={28}
                color="rgba(108, 60, 224, 0.4)"
              />
              <Text style={styles.suggestedEmptyTitle}>No suggestions yet</Text>
              <Text style={styles.suggestedEmptyHint}>
                Connect with people and add your units to see events your
                network is attending
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={!!selectedEventId}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setSelectedEventId(null);
          setSelectedRecommendation(null);
        }}
      >
        <View style={styles.modalContainer}>
          {isLoadingSelected ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color="#6C3CE0" />
            </View>
          ) : selectedEvent ? (
            <>
              {selectedEvent.bannerUrl ? (
                <View style={styles.modalBanner}>
                  <Image
                    source={{ uri: selectedEvent.bannerUrl }}
                    style={styles.modalBannerImage}
                  />
                  <LinearGradient
                    colors={["transparent", "rgba(10, 10, 26, 0.8)", "#0A0A1A"]}
                    style={styles.modalBannerOverlay}
                  />
                </View>
              ) : (
                <LinearGradient
                  colors={["#2D1B69", "#11998E"]}
                  style={styles.modalBannerFallback}
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
                    style={styles.modalBannerOverlay}
                  />
                </LinearGradient>
              )}

              <Pressable
                style={styles.modalCloseButton}
                onPress={() => {
                  setSelectedEventId(null);
                  setSelectedRecommendation(null);
                }}
              >
                <View style={styles.modalCloseInner}>
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </View>
              </Pressable>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>{selectedEvent.title}</Text>

                  {selectedRecommendation &&
                    selectedRecommendation.signals.length > 0 && (
                      <GlassCard style={styles.recommendationCard}>
                        <View style={styles.recommendationHeader}>
                          <View style={styles.recommendationIconBg}>
                            <Ionicons
                              name="sparkles"
                              size={14}
                              color="#6C3CE0"
                            />
                          </View>
                          <Text style={styles.recommendationTitle}>
                            Why this was recommended
                          </Text>
                        </View>
                        <View style={styles.recommendationSignals}>
                          {selectedRecommendation.signals.map((signal, i) => (
                            <View key={i} style={styles.signalRow}>
                              <View
                                style={[
                                  styles.signalIconBg,
                                  signal.type === "connections" && {
                                    backgroundColor:
                                      "rgba(108, 60, 224, 0.15)",
                                  },
                                  signal.type === "unit_peers" && {
                                    backgroundColor:
                                      "rgba(17, 153, 142, 0.15)",
                                  },
                                  signal.type === "popularity" && {
                                    backgroundColor:
                                      "rgba(224, 72, 130, 0.15)",
                                  },
                                  signal.type === "happening_soon" && {
                                    backgroundColor:
                                      "rgba(253, 116, 108, 0.15)",
                                  },
                                ]}
                              >
                                <Ionicons
                                  name={signal.icon as any}
                                  size={14}
                                  color={
                                    signal.type === "connections"
                                      ? "#6C3CE0"
                                      : signal.type === "unit_peers"
                                        ? "#11998E"
                                        : signal.type === "popularity"
                                          ? "#E04882"
                                          : "#FD746C"
                                  }
                                />
                              </View>
                              <View style={styles.signalContent}>
                                <Text style={styles.signalLabel}>
                                  {signal.label}
                                </Text>
                                {signal.names && signal.names.length > 0 && (
                                  <Text style={styles.signalNames}>
                                    {signal.names.join(", ")}
                                  </Text>
                                )}
                              </View>
                            </View>
                          ))}
                        </View>
                      </GlassCard>
                    )}

                  <GlassCard style={styles.modalMetaCard}>
                    <View style={styles.modalMetaRow}>
                      <View style={styles.modalMetaIconBg}>
                        <Ionicons name="calendar" size={16} color="#6C3CE0" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalMetaLabel}>Date</Text>
                        <Text style={styles.modalMetaValue}>
                          {formatFullDate(selectedEvent.date)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.modalMetaDivider} />
                    <View style={styles.modalMetaRow}>
                      <View style={styles.modalMetaIconBg}>
                        <Ionicons name="time" size={16} color="#6C3CE0" />
                      </View>
                      <View>
                        <Text style={styles.modalMetaLabel}>Time</Text>
                        <Text style={styles.modalMetaValue}>
                          {formatTime(selectedEvent.date)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.modalMetaDivider} />
                    <View style={styles.modalMetaRow}>
                      <View style={styles.modalMetaIconBg}>
                        <Ionicons name="location" size={16} color="#6C3CE0" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalMetaLabel}>Location</Text>
                        <Text style={styles.modalMetaValue}>
                          {selectedEvent.location}
                        </Text>
                      </View>
                    </View>
                  </GlassCard>

                  {selectedEvent.content ? (
                    <View style={styles.modalAbout}>
                      <Text style={styles.modalSectionTitle}>About</Text>
                      <Text style={styles.modalAboutText}>
                        {selectedEvent.content}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.modalOrganisers}>
                    <Text style={styles.modalSectionTitle}>Organisers</Text>
                    <View style={styles.modalOrganisersList}>
                      {selectedEvent.organisers.map((organiser, i) => (
                        <Pressable
                          key={organiser.id}
                          style={styles.modalOrganiserItem}
                          onPress={() => {
                            if (organiser.id !== userId) {
                              setSelectedEventId(null);
                              router.push(`/(app)/user/${organiser.id}` as any);
                            }
                          }}
                        >
                          {organiser.avatarUrl ? (
                            <Image
                              source={{ uri: organiser.avatarUrl }}
                              style={styles.modalOrganiserAvatar}
                            />
                          ) : (
                            <LinearGradient
                              colors={
                                AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]!
                              }
                              style={styles.modalOrganiserAvatar}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                            >
                              <Text style={styles.modalOrganiserInitials}>
                                {getInitials(organiser.name)}
                              </Text>
                            </LinearGradient>
                          )}
                          <Text style={styles.modalOrganiserName}>
                            {organiser.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <GlassCard style={styles.modalStatsRow}>
                    <View style={styles.modalStatItem}>
                      <Text style={styles.modalStatValue}>
                        {selectedEvent.participants.length}
                      </Text>
                      <Text style={styles.modalStatLabel}>Attending</Text>
                    </View>
                    <View style={styles.modalStatDivider} />
                    <View style={styles.modalStatItem}>
                      <Text style={styles.modalStatValue}>
                        {selectedEvent.organisers.length}
                      </Text>
                      <Text style={styles.modalStatLabel}>
                        {selectedEvent.organisers.length === 1
                          ? "Organiser"
                          : "Organisers"}
                      </Text>
                    </View>
                  </GlassCard>
                </View>
              </ScrollView>

              {!isOrganiser && (
                <View
                  style={[
                    styles.modalBottomBar,
                    { paddingBottom: insets.bottom + 16 },
                  ]}
                >
                  {selectedEvent.ticketUrl && !isParticipant && (
                    <Pressable
                      style={styles.modalTicketLink}
                      onPress={() => Linking.openURL(selectedEvent.ticketUrl!)}
                    >
                      <Ionicons
                        name="ticket-outline"
                        size={16}
                        color="#6C3CE0"
                      />
                      <Text style={styles.modalTicketLinkText}>
                        Get Tickets
                      </Text>
                      <Ionicons
                        name="open-outline"
                        size={14}
                        color="rgba(108, 60, 224, 0.6)"
                      />
                    </Pressable>
                  )}
                  <View style={styles.modalBottomActions}>
                    <Pressable
                      style={styles.modalViewFullButton}
                      onPress={() => {
                        setSelectedEventId(null);
                        setSelectedRecommendation(null);
                        router.push(`/(app)/event/${selectedEvent.id}` as any);
                      }}
                    >
                      <Text style={styles.modalViewFullText}>View Full</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleJoinLeave}
                      disabled={actionPending}
                      style={[
                        styles.modalActionButton,
                        actionPending && { opacity: 0.5 },
                      ]}
                    >
                      <LinearGradient
                        colors={
                          isParticipant
                            ? [
                                "rgba(255,255,255,0.1)",
                                "rgba(255,255,255,0.06)",
                              ]
                            : ["#6C3CE0", "#E04882"]
                        }
                        style={styles.modalActionGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        {actionPending ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons
                              name={
                                isParticipant
                                  ? "exit-outline"
                                  : "add-circle-outline"
                              }
                              size={18}
                              color="#FFFFFF"
                            />
                            <Text style={styles.modalActionText}>
                              {isParticipant ? "Leave" : "Join Event"}
                            </Text>
                          </>
                        )}
                      </LinearGradient>
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={styles.modalLoading}>
              <Ionicons
                name="alert-circle-outline"
                size={48}
                color="rgba(255,255,255,0.2)"
              />
              <Text style={styles.modalErrorText}>Event not found</Text>
              <Pressable
                style={styles.modalErrorButton}
                onPress={() => {
                  setSelectedEventId(null);
                  setSelectedRecommendation(null);
                }}
              >
                <Text style={styles.modalErrorButtonText}>Close</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A1A",
  },
  scrollView: {
    flex: 1,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.5)",
    fontWeight: "400",
  },
  userName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  carouselSection: {
    marginBottom: 32,
  },
  carouselPage: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 24,
  },
  carouselCard: {
    borderRadius: 20,
    overflow: "hidden",
  },
  carouselGradient: {
    height: 180,
    position: "relative",
    overflow: "hidden",
  },
  carouselBannerImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  carouselImageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  carouselContent: {
    flex: 1,
    justifyContent: "space-between",
  },
  carouselContentPadding: {
    padding: 24,
  },
  carouselTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  carouselLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.7)",
    letterSpacing: 0.2,
  },
  carouselTimeBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  carouselTimeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  carouselBottom: {
    gap: 4,
  },
  emptyCarousel: {
    marginHorizontal: 24,
    marginBottom: 32,
    paddingVertical: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderStyle: "dashed",
    alignItems: "center",
    gap: 6,
  },
  emptyCarouselText: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.4)",
  },
  emptyCarouselHint: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.25)",
  },
  carouselTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  carouselMeta: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.6)",
  },
  decorCircle: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },

  dotContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: "#FFFFFF",
  },
  dotInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },

  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    flex: 1,
  },
  arrowCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  arrowText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
    marginTop: -1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },

  horizontalScroll: {
    paddingHorizontal: 24,
    gap: 16,
  },
  personCard: {
    alignItems: "center",
    width: 100,
    gap: 6,
  },
  personAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  personInitials: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  personName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  personMetAt: {
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.45)",
    textAlign: "center",
  },
  noPeopleCard: {
    width: SCREEN_WIDTH - 48,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255, 255, 255, 0.1)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  noPeopleText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.45)",
    fontWeight: "500",
  },

  suggestedCard: {
    width: 180,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  suggestedImage: {
    height: 130,
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  suggestedInfo: {
    padding: 14,
    gap: 3,
  },
  suggestedOrganiser: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.45)",
  },
  suggestedTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  suggestedMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  suggestedDate: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.6)",
  },
  suggestedDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  suggestedAttendees: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.45)",
  },
  suggestedReasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  suggestedReasonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(108, 60, 224, 0.85)",
    flex: 1,
  },
  suggestedEmpty: {
    marginHorizontal: 24,
    paddingVertical: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderStyle: "dashed",
    alignItems: "center",
    gap: 8,
  },
  suggestedEmptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.35)",
  },
  suggestedEmptyHint: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.2)",
    textAlign: "center",
    paddingHorizontal: 32,
  },

  modalContainer: {
    flex: 1,
    backgroundColor: "#0A0A1A",
  },
  modalLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  modalErrorText: {
    fontSize: 17,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },
  modalErrorButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(108, 60, 224, 0.2)",
    marginTop: 4,
  },
  modalErrorButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6C3CE0",
  },
  modalBanner: {
    height: 240,
    position: "relative",
  },
  modalBannerImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  modalBannerFallback: {
    height: 240,
    position: "relative",
    overflow: "hidden",
  },
  modalBannerOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  modalCloseButton: {
    position: "absolute",
    top: 16,
    right: 20,
    zIndex: 10,
  },
  modalCloseInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalScrollView: {
    flex: 1,
    marginTop: -40,
  },
  modalScrollContent: {
    paddingBottom: 140,
  },
  modalContent: {
    paddingHorizontal: 24,
    gap: 24,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  modalMetaCard: {
    borderRadius: 18,
    padding: 4,
  },
  modalMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  modalMetaIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(108, 60, 224, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalMetaLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  modalMetaValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  modalMetaDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginHorizontal: 16,
  },
  modalAbout: {
    gap: 10,
  },
  modalSectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  modalAboutText: {
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(255,255,255,0.65)",
    fontWeight: "400",
  },
  modalOrganisers: {
    gap: 14,
  },
  modalOrganisersList: {
    flexDirection: "row",
    gap: 16,
  },
  modalOrganiserItem: {
    alignItems: "center",
    gap: 6,
  },
  modalOrganiserAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOrganiserInitials: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalOrganiserName: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    maxWidth: 80,
  },
  modalStatsRow: {
    flexDirection: "row",
    borderRadius: 18,
    padding: 20,
    alignItems: "center",
  },
  modalStatItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  } as const,
  modalStatValue: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalStatLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.4)",
  },
  modalStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  modalBottomBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: "rgba(10, 10, 26, 0.92)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  modalBottomActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalViewFullButton: {
    paddingVertical: 17,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalViewFullText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
  modalActionButton: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  modalActionGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 17,
    borderRadius: 16,
    gap: 8,
  },
  modalActionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalTicketLink: {
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
  modalTicketLinkText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6C3CE0",
  },

  recommendationCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(108, 60, 224, 0.12)",
  },
  recommendationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  recommendationIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(108, 60, 224, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: -0.1,
  },
  recommendationSignals: {
    gap: 14,
  },
  signalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  signalIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(108, 60, 224, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  signalContent: {
    flex: 1,
    gap: 2,
  },
  signalLabel: {
    fontSize: 14,
    marginTop: 5,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
    lineHeight: 20,
  },
  signalNames: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.4)",
    lineHeight: 18,
  },
});

const liveStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A1A",
  },
  topSection: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 24,
  },
  exitPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(224, 72, 130, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(224, 72, 130, 0.2)",
    marginBottom: 16,
  },
  exitPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(224, 72, 130, 0.8)",
  },
  eventHeader: {
    gap: 6,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(224, 72, 130, 0.15)",
    marginBottom: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E04882",
  },
  liveText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#E04882",
    letterSpacing: 1,
  },
  eventTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  eventMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  eventMetaText: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
  },
  emptyCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 48,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(108, 60, 224, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    fontWeight: "400",
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    lineHeight: 20,
  },
  bottomSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  bottomCard: {
    borderRadius: 22,
    padding: 18,
    gap: 14,
  },
  bottomCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  peopleCountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  peopleCountIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(17, 153, 142, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  peopleCountText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  moreText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.4)",
  },
  bottomActions: {
    flexDirection: "row",
    gap: 10,
  },
  chatButton: {
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
  chatButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6C3CE0",
  },
  viewButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.65)",
  },
  avatarCircle: {
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
