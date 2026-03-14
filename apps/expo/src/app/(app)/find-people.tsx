import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trpc } from "~/utils/api";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.58;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
const SWIPE_VELOCITY = 500;

const GRADIENT_PAIRS: [string, string][] = [
  ["#2D1B69", "#11998E"],
  ["#4A1942", "#E04882"],
  ["#1A2980", "#26D0CE"],
  ["#2C3E50", "#FD746C"],
  ["#6C3CE0", "#E04882"],
  ["#134E5E", "#71B280"],
  ["#0F2027", "#2C5364"],
];

function getGradientForId(id: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENT_PAIRS[Math.abs(hash) % GRADIENT_PAIRS.length]!;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type DiscoverProfile = {
  id: string;
  name: string;
  displayName: string | null;
  image: string | null;
  bio: string | null;
  university: string | null;
  courses: string[];
  sharedEventCount: number;
  nextSharedEvent: {
    id: string;
    title: string;
    date: Date | string;
  } | null;
  score: number;
  reasons: string[];
};

type MatchedInfo = {
  profile: DiscoverProfile;
  matchedAt: Date;
};

function MatchOverlay({
  visible,
  matchedUser,
  onDismiss,
  onViewProfile,
}: {
  visible: boolean;
  matchedUser: DiscoverProfile | null;
  onDismiss: () => void;
  onViewProfile: () => void;
}) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const ringScale1 = useSharedValue(0);
  const ringScale2 = useSharedValue(0);
  const ringScale3 = useSharedValue(0);
  const textY = useSharedValue(30);
  const buttonsY = useSharedValue(40);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSequence(
        withTiming(1.15, { duration: 350, easing: Easing.out(Easing.back(2)) }),
        withSpring(1, { damping: 12, stiffness: 150 }),
      );
      ringScale1.value = withDelay(
        100,
        withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }),
      );
      ringScale2.value = withDelay(
        250,
        withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }),
      );
      ringScale3.value = withDelay(
        400,
        withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }),
      );
      textY.value = withDelay(
        200,
        withSpring(0, { damping: 14, stiffness: 120 }),
      );
      buttonsY.value = withDelay(
        350,
        withSpring(0, { damping: 14, stiffness: 120 }),
      );
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0, { duration: 200 });
      ringScale1.value = 0;
      ringScale2.value = 0;
      ringScale3.value = 0;
      textY.value = 30;
      buttonsY.value = 40;
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    pointerEvents: opacity.value > 0.5 ? "auto" : "none",
  }));

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale1.value }],
    opacity: interpolate(ringScale1.value, [0, 0.5, 1], [0, 0.5, 0.15]),
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale2.value }],
    opacity: interpolate(ringScale2.value, [0, 0.5, 1], [0, 0.4, 0.1]),
  }));

  const ring3Style = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale3.value }],
    opacity: interpolate(ringScale3.value, [0, 0.5, 1], [0, 0.3, 0.05]),
  }));

  const textStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: textY.value }],
    opacity: interpolate(textY.value, [30, 0], [0, 1]),
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: buttonsY.value }],
    opacity: interpolate(buttonsY.value, [40, 0], [0, 1]),
  }));

  if (!matchedUser) return null;

  const name = matchedUser.displayName ?? matchedUser.name;
  const gradient = getGradientForId(matchedUser.id);

  return (
    <Animated.View style={[styles.matchOverlay, containerStyle]}>
      <View style={styles.matchContent}>
        <View style={styles.matchRingContainer}>
          <Animated.View style={[styles.matchRing, styles.matchRing3, ring3Style]} />
          <Animated.View style={[styles.matchRing, styles.matchRing2, ring2Style]} />
          <Animated.View style={[styles.matchRing, styles.matchRing1, ring1Style]} />
          <Animated.View style={avatarStyle}>
            {matchedUser.image ? (
              <Image
                source={{ uri: matchedUser.image }}
                style={styles.matchAvatar}
              />
            ) : (
              <LinearGradient
                colors={gradient}
                style={styles.matchAvatar}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.matchAvatarText}>
                  {getInitials(name)}
                </Text>
              </LinearGradient>
            )}
          </Animated.View>
        </View>

        <Animated.View style={[styles.matchTextContainer, textStyle]}>
          <Text style={styles.matchTitle}>It's a Match!</Text>
          <Text style={styles.matchSubtitle}>
            You and {name} are now connected
          </Text>
          {matchedUser.nextSharedEvent && (
            <View style={styles.matchEventBadge}>
              <Ionicons name="calendar" size={14} color="#6C3CE0" />
              <Text style={styles.matchEventText}>
                Meet at {matchedUser.nextSharedEvent.title}
              </Text>
            </View>
          )}
        </Animated.View>

        <Animated.View style={[styles.matchButtons, buttonsStyle]}>
          <Pressable
            onPress={onViewProfile}
            style={({ pressed }) => [
              styles.matchPrimaryButton,
              pressed && { opacity: 0.85 },
            ]}
          >
            <LinearGradient
              colors={["#6C3CE0", "#E04882"]}
              style={styles.matchPrimaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.matchPrimaryText}>View Profile</Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.matchSecondaryButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.matchSecondaryText}>Keep Swiping</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

function SessionSummary({
  matches,
  swipeCount,
  onViewMatch,
  onRefresh,
  onClose,
}: {
  matches: MatchedInfo[];
  swipeCount: number;
  onViewMatch: (id: string) => void;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.summaryContainer}>
      <ScrollView
        contentContainerStyle={[
          styles.summaryScroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <LinearGradient
            colors={matches.length > 0 ? ["#6C3CE0", "#E04882"] : ["#2C3E50", "#4A5568"]}
            style={styles.summaryIconWrap}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons
              name={matches.length > 0 ? "heart" : "checkmark-done"}
              size={36}
              color="#FFFFFF"
            />
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.summaryTextWrap}>
          <Text style={styles.summaryTitle}>
            {matches.length > 0 ? "You Got Matches!" : "All Done!"}
          </Text>
          <Text style={styles.summarySubtitle}>
            You swiped through {swipeCount} {swipeCount === 1 ? "person" : "people"}
            {matches.length > 0
              ? ` and matched with ${matches.length}!`
              : ". Check back later for new people!"}
          </Text>
        </Animated.View>

        {matches.length > 0 && (
          <Animated.View entering={FadeInDown.delay(350).duration(500)} style={styles.summaryMatchList}>
            <Text style={styles.summaryMatchLabel}>Your Matches</Text>
            {matches.map((match, idx) => {
              const name = match.profile.displayName ?? match.profile.name;
              const gradient = getGradientForId(match.profile.id);
              return (
                <Pressable
                  key={match.profile.id}
                  onPress={() => onViewMatch(match.profile.id)}
                  style={({ pressed }) => [
                    styles.summaryMatchCard,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                  ]}
                >
                  {match.profile.image ? (
                    <Image source={{ uri: match.profile.image }} style={styles.summaryAvatar} />
                  ) : (
                    <LinearGradient
                      colors={gradient}
                      style={styles.summaryAvatar}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Text style={styles.summaryAvatarText}>{getInitials(name)}</Text>
                    </LinearGradient>
                  )}
                  <View style={styles.summaryMatchInfo}>
                    <Text style={styles.summaryMatchName} numberOfLines={1}>{name}</Text>
                    {match.profile.university && (
                      <Text style={styles.summaryMatchUni} numberOfLines={1}>
                        {match.profile.university}
                      </Text>
                    )}
                    {match.profile.nextSharedEvent && (
                      <View style={styles.summaryMeetBadge}>
                        <Ionicons name="location" size={11} color="#FCD34D" />
                        <Text style={styles.summaryMeetText} numberOfLines={1}>
                          Meet at {match.profile.nextSharedEvent.title}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
                </Pressable>
              );
            })}
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.summaryActions}>
          <Pressable
            onPress={onRefresh}
            style={({ pressed }) => [
              styles.summaryPrimaryBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <LinearGradient
              colors={["#6C3CE0", "#9B59E0"]}
              style={styles.summaryPrimaryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text style={styles.summaryPrimaryText}>Find More People</Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.summarySecondaryBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.summarySecondaryText}>Done</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function SwipeCard({
  profile,
  isTop,
  onSwipe,
}: {
  profile: DiscoverProfile;
  isTop: boolean;
  onSwipe: (direction: "LEFT" | "RIGHT") => void;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardRotate = useSharedValue(0);
  const likeOpacity = useSharedValue(0);
  const nopeOpacity = useSharedValue(0);

  const handleSwipeComplete = useCallback(
    (direction: "LEFT" | "RIGHT") => {
      onSwipe(direction);
    },
    [onSwipe],
  );

  const panGesture = Gesture.Pan()
    .enabled(isTop)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.4;
      cardRotate.value = (event.translationX / SCREEN_WIDTH) * 15;
      likeOpacity.value = Math.max(0, event.translationX / (SWIPE_THRESHOLD * 0.8));
      nopeOpacity.value = Math.max(0, -event.translationX / (SWIPE_THRESHOLD * 0.8));
    })
    .onEnd((event) => {
      const shouldSwipeRight =
        event.translationX > SWIPE_THRESHOLD ||
        event.velocityX > SWIPE_VELOCITY;
      const shouldSwipeLeft =
        event.translationX < -SWIPE_THRESHOLD ||
        event.velocityX < -SWIPE_VELOCITY;

      if (shouldSwipeRight) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 300 });
        translateY.value = withTiming(event.translationY * 0.5, { duration: 300 });
        cardRotate.value = withTiming(20, { duration: 300 });
        likeOpacity.value = withTiming(1, { duration: 150 });
        runOnJS(handleSwipeComplete)("RIGHT");
      } else if (shouldSwipeLeft) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 300 });
        translateY.value = withTiming(event.translationY * 0.5, { duration: 300 });
        cardRotate.value = withTiming(-20, { duration: 300 });
        nopeOpacity.value = withTiming(1, { duration: 150 });
        runOnJS(handleSwipeComplete)("LEFT");
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        cardRotate.value = withSpring(0, { damping: 20, stiffness: 300 });
        likeOpacity.value = withTiming(0, { duration: 200 });
        nopeOpacity.value = withTiming(0, { duration: 200 });
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    if (!isTop) {
      return {
        transform: [
          { scale: 0.95 },
          { translateY: 12 },
        ],
        opacity: 0.5,
      };
    }
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${cardRotate.value}deg` },
      ],
    };
  });

  const likeStyle = useAnimatedStyle(() => ({
    opacity: likeOpacity.value,
    transform: [{ scale: interpolate(likeOpacity.value, [0, 1], [0.5, 1]) }],
  }));

  const nopeStyle = useAnimatedStyle(() => ({
    opacity: nopeOpacity.value,
    transform: [{ scale: interpolate(nopeOpacity.value, [0, 1], [0.5, 1]) }],
  }));

  const name = profile.displayName ?? profile.name;
  const gradient = getGradientForId(profile.id);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, cardStyle]}>
        {profile.image ? (
          <Image source={{ uri: profile.image }} style={styles.cardImage} />
        ) : (
          <LinearGradient
            colors={gradient}
            style={styles.cardGradientBg}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.cardPatternDot1} />
            <View style={styles.cardPatternDot2} />
            <View style={styles.cardPatternDot3} />
            <View style={styles.cardInitialsContainer}>
              <Text style={styles.cardInitials}>{getInitials(name)}</Text>
            </View>
          </LinearGradient>
        )}

        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.92)"]}
          style={styles.cardFade}
          locations={[0, 0.35, 1]}
        />

        {isTop && (
          <>
            <Animated.View style={[styles.swipeLabel, styles.likeLabel, likeStyle]}>
              <Text style={styles.likeLabelText}>CONNECT</Text>
            </Animated.View>
            <Animated.View style={[styles.swipeLabel, styles.nopeLabel, nopeStyle]}>
              <Text style={styles.nopeLabelText}>SKIP</Text>
            </Animated.View>
          </>
        )}

        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>
            {name}
          </Text>

          {profile.university && (
            <View style={styles.cardUniBadge}>
              <Ionicons name="school-outline" size={13} color="rgba(255,255,255,0.8)" />
              <Text style={styles.cardUniText}>{profile.university}</Text>
            </View>
          )}

          {profile.bio && (
            <Text style={styles.cardBio} numberOfLines={2}>
              {profile.bio}
            </Text>
          )}

          {profile.reasons.length > 0 && (
            <View style={styles.reasonsRow}>
              {profile.reasons.slice(0, 2).map((reason, idx) => (
                <View key={idx} style={styles.reasonChip}>
                  <Ionicons
                    name={
                      reason.includes("event")
                        ? "calendar"
                        : reason.includes("course") || reason.includes("Shares")
                          ? "book"
                          : "school"
                    }
                    size={12}
                    color="#A78BFA"
                  />
                  <Text style={styles.reasonText}>{reason}</Text>
                </View>
              ))}
            </View>
          )}

          {profile.nextSharedEvent && (
            <View style={styles.sharedEventCard}>
              <Ionicons name="sparkles" size={14} color="#FCD34D" />
              <Text style={styles.sharedEventText} numberOfLines={1}>
                Both going to {profile.nextSharedEvent.title}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export default function FindPeopleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchedProfile, setMatchedProfile] = useState<DiscoverProfile | null>(null);
  const [showMatch, setShowMatch] = useState(false);
  const [swipeCount, setSwipeCount] = useState(0);
  const [sessionMatches, setSessionMatches] = useState<MatchedInfo[]>([]);
  const lastSwipedRef = useRef<string | null>(null);

  const { data, isLoading, refetch } = useQuery(
    trpc.discover.getDiscoverFeed.queryOptions({ limit: 20 }),
  );

  const swipeMutation = useMutation(
    trpc.discover.swipe.mutationOptions({
      onSuccess: (
        result: { matched: boolean },
        variables: { targetUserId: string; direction: "LEFT" | "RIGHT" },
      ) => {
        if (result.matched) {
          const profile = profiles.find(
            (p) => p.id === variables.targetUserId,
          );
          if (profile) {
            setMatchedProfile(profile);
            setShowMatch(true);
            setSessionMatches((prev) => [
              ...prev,
              { profile, matchedAt: new Date() },
            ]);
          }
          queryClient.invalidateQueries({
            queryKey: [["connection"]],
          });
          queryClient.invalidateQueries({
            queryKey: [["discover", "getMatches"]],
          });
        }
      },
    }),
  );

  const undoMutation = useMutation(
    trpc.discover.undoLastSwipe.mutationOptions({
      onSuccess: () => {
        if (currentIndex > 0) {
          setCurrentIndex((prev) => prev - 1);
          setSwipeCount((prev) => prev - 1);
        }
      },
    }),
  );

  const profiles: DiscoverProfile[] = data?.profiles ?? [];
  const visibleProfiles = profiles.slice(currentIndex, currentIndex + 2);

  const handleSwipe = useCallback(
    (direction: "LEFT" | "RIGHT") => {
      const profile = profiles[currentIndex];
      if (!profile) return;

      lastSwipedRef.current = profile.id;
      setSwipeCount((prev) => prev + 1);

      swipeMutation.mutate({
        targetUserId: profile.id,
        direction,
      });

      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1);
      }, 350);
    },
    [currentIndex, profiles, swipeMutation],
  );

  const handleButtonSwipe = useCallback(
    (direction: "LEFT" | "RIGHT") => {
      handleSwipe(direction);
    },
    [handleSwipe],
  );

  const handleUndo = useCallback(() => {
    if (swipeCount > 0 && !undoMutation.isPending) {
      undoMutation.mutate();
    }
  }, [swipeCount, undoMutation]);

  const handleMatchDismiss = useCallback(() => {
    setShowMatch(false);
    setMatchedProfile(null);
  }, []);

  const handleViewMatchProfile = useCallback(() => {
    setShowMatch(false);
    if (matchedProfile) {
      router.push(`/(app)/user/${matchedProfile.id}` as any);
    }
    setMatchedProfile(null);
  }, [matchedProfile, router]);

  const handleRefresh = useCallback(() => {
    setCurrentIndex(0);
    setSwipeCount(0);
    setSessionMatches([]);
    refetch();
  }, [refetch]);

  const isOutOfProfiles = !isLoading && profiles.length > 0 && currentIndex >= profiles.length;

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Discover</Text>
          {profiles.length > 0 && !isOutOfProfiles && (
            <Text style={styles.headerCount}>
              {currentIndex + 1} / {profiles.length}
            </Text>
          )}
        </View>
        <Pressable
          onPress={handleUndo}
          disabled={swipeCount === 0 || undoMutation.isPending}
          style={({ pressed }) => [
            styles.headerButton,
            (swipeCount === 0 || undoMutation.isPending) && { opacity: 0.25 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="arrow-undo" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.cardsContainer}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6C3CE0" />
            <Text style={styles.loadingText}>Finding people for you...</Text>
          </View>
        ) : isOutOfProfiles ? (
          <SessionSummary
            matches={sessionMatches}
            swipeCount={swipeCount}
            onViewMatch={(id) => router.push(`/(app)/user/${id}` as any)}
            onRefresh={handleRefresh}
            onClose={() => router.back()}
          />
        ) : profiles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <LinearGradient
              colors={["#2C3E50", "#4A5568"]}
              style={styles.emptyIconWrap}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="people-outline" size={40} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No one to discover</Text>
            <Text style={styles.emptySubtitle}>
              Join more events to see more people here!
            </Text>
            <Pressable
              onPress={handleRefresh}
              style={({ pressed }) => [
                styles.refreshButton,
                pressed && { opacity: 0.85 },
              ]}
            >
              <LinearGradient
                colors={["#6C3CE0", "#9B59E0"]}
                style={styles.refreshGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="refresh" size={18} color="#FFFFFF" />
                <Text style={styles.refreshText}>Refresh</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cardStack}>
            {visibleProfiles
              .slice()
              .reverse()
              .map((profile, reverseIdx) => {
                const actualIdx =
                  visibleProfiles.length - 1 - reverseIdx;
                return (
                  <SwipeCard
                    key={profile.id}
                    profile={profile}
                    isTop={actualIdx === 0}
                    onSwipe={handleSwipe}
                  />
                );
              })}
          </View>
        )}
      </View>

      {!isLoading && !isOutOfProfiles && visibleProfiles.length > 0 && (
        <View style={[styles.actions, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            onPress={() => handleButtonSwipe("LEFT")}
            style={({ pressed }) => [
              styles.actionButton,
              styles.skipButton,
              pressed && { transform: [{ scale: 0.92 }] },
            ]}
          >
            <Ionicons name="close" size={30} color="#FF6B6B" />
          </Pressable>

          <Pressable
            onPress={() => {
              const profile = profiles[currentIndex];
              if (profile) {
                router.push(`/(app)/user/${profile.id}` as any);
              }
            }}
            style={({ pressed }) => [
              styles.actionButton,
              styles.infoButton,
              pressed && { transform: [{ scale: 0.92 }] },
            ]}
          >
            <Ionicons name="person" size={22} color="#60A5FA" />
          </Pressable>

          <Pressable
            onPress={() => handleButtonSwipe("RIGHT")}
            style={({ pressed }) => [
              styles.actionButton,
              styles.connectButton,
              pressed && { transform: [{ scale: 0.92 }] },
            ]}
          >
            <Ionicons name="heart" size={30} color="#34D399" />
          </Pressable>
        </View>
      )}

      <MatchOverlay
        visible={showMatch}
        matchedUser={matchedProfile}
        onDismiss={handleMatchDismiss}
        onViewProfile={handleViewMatchProfile}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A1A",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
    zIndex: 10,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  headerCount: {
    fontSize: 12,
    fontWeight: "500",
    color: "rgba(255,255,255,0.35)",
  },

  cardsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cardStack: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    position: "relative",
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: "hidden",
    position: "absolute",
    backgroundColor: "#1A1A2E",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  cardImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  cardGradientBg: {
    width: "100%",
    height: "100%",
    position: "relative",
    overflow: "hidden",
  },
  cardPatternDot1: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -40,
    right: -30,
  },
  cardPatternDot2: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: 120,
    left: -20,
  },
  cardPatternDot3: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: 80,
    left: 60,
  },
  cardInitialsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cardInitials: {
    fontSize: 80,
    fontWeight: "800",
    color: "rgba(255,255,255,0.25)",
    letterSpacing: 2,
  },
  cardFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: CARD_HEIGHT * 0.6,
  },

  swipeLabel: {
    position: "absolute",
    top: 32,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 3,
  },
  likeLabel: {
    left: 24,
    borderColor: "#34D399",
    transform: [{ rotate: "-15deg" }],
  },
  likeLabelText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#34D399",
    letterSpacing: 2,
  },
  nopeLabel: {
    right: 24,
    borderColor: "#FF6B6B",
    transform: [{ rotate: "15deg" }],
  },
  nopeLabelText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FF6B6B",
    letterSpacing: 2,
  },

  cardInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 22,
    gap: 6,
  },
  cardName: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  cardUniBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  cardUniText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
  },
  cardBio: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255,255,255,0.55)",
    lineHeight: 18,
  },
  reasonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  reasonChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(108, 60, 224, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(108, 60, 224, 0.3)",
  },
  reasonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#C4B5FD",
  },
  sharedEventCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(252, 211, 77, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(252, 211, 77, 0.2)",
    alignSelf: "flex-start",
    marginTop: 2,
  },
  sharedEventText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FCD34D",
  },

  actions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    paddingTop: 16,
  },
  actionButton: {
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  skipButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255, 107, 107, 0.12)",
    borderWidth: 2,
    borderColor: "rgba(255, 107, 107, 0.25)",
  },
  infoButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(96, 165, 250, 0.12)",
    borderWidth: 2,
    borderColor: "rgba(96, 165, 250, 0.25)",
  },
  connectButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(52, 211, 153, 0.12)",
    borderWidth: 2,
    borderColor: "rgba(52, 211, 153, 0.25)",
  },

  loadingContainer: {
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(255,255,255,0.4)",
  },

  emptyContainer: {
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: "400",
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    lineHeight: 22,
  },
  refreshButton: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 4,
  },
  refreshGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  refreshText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Session summary
  summaryContainer: {
    flex: 1,
    width: "100%",
  },
  summaryScroll: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 20,
    gap: 20,
  },
  summaryIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryTextWrap: {
    alignItems: "center",
    gap: 8,
  },
  summaryTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  summarySubtitle: {
    fontSize: 15,
    fontWeight: "400",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  summaryMatchList: {
    width: "100%",
    gap: 10,
  },
  summaryMatchLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  summaryMatchCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(108, 60, 224, 0.2)",
  },
  summaryAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(108, 60, 224, 0.4)",
  },
  summaryAvatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  summaryMatchInfo: {
    flex: 1,
    gap: 3,
  },
  summaryMatchName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  summaryMatchUni: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255,255,255,0.45)",
  },
  summaryMeetBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  summaryMeetText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FCD34D",
  },
  summaryActions: {
    width: "100%",
    gap: 12,
    marginTop: 8,
  },
  summaryPrimaryBtn: {
    borderRadius: 16,
    overflow: "hidden",
  },
  summaryPrimaryGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  summaryPrimaryText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  summarySecondaryBtn: {
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  summarySecondaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },

  matchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 5, 15, 0.92)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  matchContent: {
    alignItems: "center",
    gap: 28,
    paddingHorizontal: 32,
  },
  matchRingContainer: {
    width: 180,
    height: 180,
    justifyContent: "center",
    alignItems: "center",
  },
  matchRing: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#6C3CE0",
  },
  matchRing1: {
    width: 140,
    height: 140,
  },
  matchRing2: {
    width: 170,
    height: 170,
  },
  matchRing3: {
    width: 200,
    height: 200,
  },
  matchAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#6C3CE0",
  },
  matchAvatarText: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  matchTextContainer: {
    alignItems: "center",
    gap: 8,
  },
  matchTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  matchSubtitle: {
    fontSize: 16,
    fontWeight: "400",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  matchEventBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(108, 60, 224, 0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(108, 60, 224, 0.3)",
  },
  matchEventText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#A78BFA",
  },
  matchButtons: {
    width: "100%",
    gap: 12,
    marginTop: 4,
  },
  matchPrimaryButton: {
    borderRadius: 16,
    paddingHorizontal: 10,
    overflow: "hidden",
  },
  matchPrimaryGradient: {
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 16,
  },
  matchPrimaryText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  matchSecondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  matchSecondaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },
});
