import { memo, useEffect, useMemo } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { GlassCard } from "~/components/GlassCard";
import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
  Dimensions.get("window");

const AVATAR_GRADIENTS: [string, string][] = [
  ["#6C3CE0", "#E04882"],
  ["#4880E0", "#11998E"],
  ["#E04882", "#FD746C"],
  ["#11998E", "#26D0CE"],
  ["#2D1B69", "#6C3CE0"],
];

const BORDER_COLORS = [
  "#6C3CE0",
  "#E04882",
  "#11998E",
  "#4880E0",
  "#FD746C",
  "#26D0CE",
];

const FLOAT_SIZES = [44, 52, 64, 72, 80] as const;
const easeInOutSin = Easing.inOut(Easing.sin);

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
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

function computeLayout(
  users: { id: string; name: string; image: string | null; checkedInAt: Date }[],
  screenW: number,
  screenH: number,
  topInset: number,
): PlacedAvatar[] {
  const padding = 24;
  const topOffset = topInset + 100;
  const bottomOffset = 180;
  const usableW = screenW - padding * 2;
  const usableH = screenH - topOffset - bottomOffset;
  const maxVisible = 15;
  const visible = users.slice(0, maxVisible);
  const placed: PlacedAvatar[] = [];

  for (let i = 0; i < visible.length; i++) {
    const user = visible[i]!;
    const size = FLOAT_SIZES[i < 3 ? 4 - i : Math.max(0, i % FLOAT_SIZES.length)]!;

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
      borderColor: BORDER_COLORS[i % BORDER_COLORS.length]!,
      driftY: 8 + (i % 5) * 3,
      driftX: 5 + (i % 4) * 2,
      durationY: 3000 + (i % 4) * 800,
      durationX: 3500 + (i % 3) * 900,
      delay: i * 150,
    });
  }

  return placed;
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
          s.avatarCircle,
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

const MemoAvatar = memo(FloatingAvatar);

export default function EventLiveScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const { data: event } = useQuery(trpc.event.getById.queryOptions({ id }));

  const { data: checkedInUsers = [] } = useQuery({
    ...trpc.event.getCheckedInUsers.queryOptions({ eventId: id }),
    refetchInterval: 10000,
  });

  const { data: checkInStatus } = useQuery(
    trpc.event.getCheckInStatus.queryOptions({ eventId: id }),
  );

  const avatarLayout = useMemo(() => {
    if (checkedInUsers.length === 0) return [];
    return computeLayout(
      checkedInUsers as { id: string; name: string; image: string | null; checkedInAt: Date }[],
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
      insets.top,
    );
  }, [checkedInUsers, insets.top]);

  const remaining = checkedInUsers.length > 15 ? checkedInUsers.length - 15 : 0;

  return (
    <View style={s.container}>
      <LinearGradient
        colors={["#0A0A1A", "#0D0D20", "#0A0A1A"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {avatarLayout.map((avatar) => (
        <MemoAvatar
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
        style={[s.topSection, { paddingTop: insets.top + 12 }]}
        pointerEvents="box-none"
      >
        <View style={s.topRow}>
          <View style={s.liveIndicator}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>LIVE</Text>
          </View>
          <Pressable style={s.closeButton} onPress={() => router.back()}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <Text style={s.eventTitle} numberOfLines={2}>
          {event?.title}
        </Text>
        <View style={s.eventMetaRow}>
          <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.5)" />
          <Text style={s.eventMetaText}>{event?.location}</Text>
        </View>
      </View>

      {checkedInUsers.length === 0 && (
        <View style={s.emptyCenter}>
          <View style={s.emptyIcon}>
            <Ionicons name="scan-outline" size={36} color="rgba(108, 60, 224, 0.5)" />
          </View>
          <Text style={s.emptyTitle}>No one checked in yet</Text>
          <Text style={s.emptyHint}>
            Attendees will appear here when they scan the check-in QR code
          </Text>
        </View>
      )}

      <View
        style={[s.bottomSection, { paddingBottom: insets.bottom + 16 }]}
        pointerEvents="box-none"
      >
        <GlassCard style={s.bottomCard}>
          <View style={s.bottomCardTop}>
            <View style={s.peopleCountRow}>
              <View style={s.peopleCountIcon}>
                <Ionicons name="people" size={16} color="#11998E" />
              </View>
              <Text style={s.peopleCountText}>
                {checkInStatus?.totalCheckedIn ?? 0}{" "}
                {(checkInStatus?.totalCheckedIn ?? 0) === 1 ? "person" : "people"} here
              </Text>
              {remaining > 0 && (
                <Text style={s.moreText}>+{remaining} more</Text>
              )}
            </View>
          </View>

          <View style={s.bottomActions}>
            <Pressable
              style={({ pressed }) => [
                s.chatButton,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => router.push(`/(app)/event-chat/${id}` as any)}
            >
              <Ionicons name="chatbubbles" size={16} color="#6C3CE0" />
              <Text style={s.chatButtonText}>Event Chat</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                s.viewButton,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => router.push(`/(app)/event/${id}` as any)}
            >
              <Text style={s.viewButtonText}>View Event</Text>
              <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.5)" />
            </Pressable>
          </View>
        </GlassCard>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
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
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(224, 72, 130, 0.15)",
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
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  eventTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    lineHeight: 32,
    marginBottom: 6,
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
