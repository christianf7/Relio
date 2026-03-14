import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  Layout,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { trpc } from "~/utils/api";

let GlassView: React.ComponentType<any> | null = null;
try {
  GlassView = require("expo-glass-effect").GlassView;
} catch {
  GlassView = null;
}

const AVATAR_GRADIENTS: [string, string][] = [
  ["#6C3CE0", "#E04882"],
  ["#4880E0", "#11998E"],
  ["#E04882", "#FD746C"],
  ["#11998E", "#26D0CE"],
  ["#2D1B69", "#6C3CE0"],
];

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

function timeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

type IncomingRequest = {
  id: string;
  message?: string | null;
  createdAt: string | Date;
  sender: {
    id: string;
    name: string;
    displayName: string | null;
    image: string | null;
  };
};

type OutgoingRequest = {
  id: string;
  createdAt: string | Date;
  receiver: {
    id: string;
    name: string;
    displayName: string | null;
    image: string | null;
  };
};

function IncomingRequestCard({
  request,
  index,
  onAccept,
  onDecline,
  onPress,
  isAccepting,
  isDeclining,
}: {
  request: IncomingRequest;
  index: number;
  onAccept: () => void;
  onDecline: () => void;
  onPress: () => void;
  isAccepting: boolean;
  isDeclining: boolean;
}) {
  const name = request.sender.displayName ?? request.sender.name;
  const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]!;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify().damping(18)}
      exiting={FadeOut.duration(200)}
      layout={Layout.springify().damping(18)}
    >
      <Pressable
        style={({ pressed }) => [
          styles.requestCard,
          pressed && styles.requestCardPressed,
        ]}
        onPress={onPress}
      >
        <View style={styles.requestCardTop}>
          {request.sender.image ? (
            <Image
              source={{ uri: request.sender.image }}
              style={styles.avatar}
            />
          ) : (
            <LinearGradient
              colors={gradient}
              style={styles.avatar}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
            </LinearGradient>
          )}
          <View style={styles.requestInfo}>
            <Text style={styles.requestName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.requestTime}>
              {timeAgo(request.createdAt)}
            </Text>
          </View>
        </View>

        {request.message ? (
          <View style={styles.messageContainer}>
            <Ionicons
              name="chatbubble-outline"
              size={13}
              color="rgba(255,255,255,0.3)"
            />
            <Text style={styles.messageText} numberOfLines={2}>
              "{request.message}"
            </Text>
          </View>
        ) : null}

        <View style={styles.requestActions}>
          <Pressable
            onPress={onAccept}
            disabled={isAccepting || isDeclining}
            style={({ pressed }) => [
              styles.acceptButton,
              pressed && styles.acceptButtonPressed,
              (isAccepting || isDeclining) && styles.buttonDisabled,
            ]}
          >
            {isAccepting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={17} color="#FFFFFF" />
                <Text style={styles.acceptButtonText}>Accept</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={onDecline}
            disabled={isAccepting || isDeclining}
            style={({ pressed }) => [
              styles.declineButton,
              pressed && styles.declineButtonPressed,
              (isAccepting || isDeclining) && styles.buttonDisabled,
            ]}
          >
            {isDeclining ? (
              <ActivityIndicator
                size="small"
                color="rgba(255,255,255,0.5)"
              />
            ) : (
              <>
                <Ionicons
                  name="close"
                  size={17}
                  color="rgba(255,255,255,0.6)"
                />
                <Text style={styles.declineButtonText}>Decline</Text>
              </>
            )}
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function OutgoingRequestCard({
  request,
  index,
  onCancel,
  onPress,
  isCancelling,
}: {
  request: OutgoingRequest;
  index: number;
  onCancel: () => void;
  onPress: () => void;
  isCancelling: boolean;
}) {
  const name = request.receiver.displayName ?? request.receiver.name;
  const gradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]!;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify().damping(18)}
      exiting={FadeOut.duration(200)}
      layout={Layout.springify().damping(18)}
    >
      <Pressable
        style={({ pressed }) => [
          styles.outgoingCard,
          pressed && styles.outgoingCardPressed,
        ]}
        onPress={onPress}
      >
        {request.receiver.image ? (
          <Image
            source={{ uri: request.receiver.image }}
            style={styles.outgoingAvatar}
          />
        ) : (
          <LinearGradient
            colors={gradient}
            style={styles.outgoingAvatar}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.outgoingInitials}>{getInitials(name)}</Text>
          </LinearGradient>
        )}
        <View style={styles.outgoingInfo}>
          <Text style={styles.outgoingName} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.outgoingMeta}>
            <Ionicons
              name="time-outline"
              size={12}
              color="rgba(255,255,255,0.3)"
            />
            <Text style={styles.outgoingTime}>
              Sent {timeAgo(request.createdAt)}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onCancel}
          disabled={isCancelling}
          hitSlop={8}
          style={({ pressed }) => [
            styles.cancelChip,
            pressed && styles.cancelChipPressed,
          ]}
        >
          {isCancelling ? (
            <ActivityIndicator
              size="small"
              color="rgba(255,255,255,0.5)"
            />
          ) : (
            <Text style={styles.cancelChipText}>Cancel</Text>
          )}
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

type SectionData = {
  title: string;
  data: (IncomingRequest | OutgoingRequest)[];
  type: "incoming" | "outgoing";
};

export default function ConnectionRequestsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const {
    data: incoming,
    isLoading: incomingLoading,
    refetch: refetchIncoming,
    isRefetching: isRefetchingIncoming,
  } = useQuery(trpc.connection.getIncomingRequests.queryOptions());

  const {
    data: outgoing,
    isLoading: outgoingLoading,
    refetch: refetchOutgoing,
    isRefetching: isRefetchingOutgoing,
  } = useQuery(trpc.connection.getOutgoingRequests.queryOptions());

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [["connection", "getIncomingRequests"]],
    });
    queryClient.invalidateQueries({
      queryKey: [["connection", "getOutgoingRequests"]],
    });
    queryClient.invalidateQueries({
      queryKey: [["connection", "getConnections"]],
    });
    queryClient.invalidateQueries({
      queryKey: [["user", "getMe"]],
    });
  }, [queryClient]);

  const acceptMutation = useMutation(
    trpc.connection.acceptConnection.mutationOptions({
      onSuccess: () => {
        invalidateAll();
        setAcceptingId(null);
      },
      onError: () => setAcceptingId(null),
    }),
  );

  const declineMutation = useMutation(
    trpc.connection.declineConnection.mutationOptions({
      onSuccess: () => {
        invalidateAll();
        setDecliningId(null);
      },
      onError: () => setDecliningId(null),
    }),
  );

  const cancelMutation = useMutation(
    trpc.connection.cancelOutgoingRequest.mutationOptions({
      onSuccess: () => {
        invalidateAll();
        setCancellingId(null);
      },
      onError: () => setCancellingId(null),
    }),
  );

  const incomingRequests = (incoming ?? []) as IncomingRequest[];
  const outgoingRequests = (outgoing ?? []) as OutgoingRequest[];
  const isLoading = incomingLoading || outgoingLoading;
  const totalCount = incomingRequests.length + outgoingRequests.length;

  const sections: SectionData[] = [];
  if (incomingRequests.length > 0) {
    sections.push({
      title: `Incoming (${incomingRequests.length})`,
      data: incomingRequests,
      type: "incoming",
    });
  }
  if (outgoingRequests.length > 0) {
    sections.push({
      title: `Sent (${outgoingRequests.length})`,
      data: outgoingRequests,
      type: "outgoing",
    });
  }

  const handleRefresh = useCallback(() => {
    refetchIncoming();
    refetchOutgoing();
  }, [refetchIncoming, refetchOutgoing]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6C3CE0" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Requests</Text>
          {totalCount > 0 && (
            <View style={styles.headerCountBadge}>
              <Text style={styles.headerCountText}>{totalCount}</Text>
            </View>
          )}
        </View>
        <View style={{ width: 44 }} />
      </View>

      {totalCount === 0 ? (
        <Animated.View
          entering={FadeIn.delay(200).duration(400)}
          style={styles.emptyState}
        >
          <View style={styles.emptyIconWrapper}>
            <LinearGradient
              colors={["rgba(108, 60, 224, 0.2)", "rgba(224, 72, 130, 0.2)"]}
              style={styles.emptyIconGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons
                name="mail-open-outline"
                size={44}
                color="rgba(108, 60, 224, 0.6)"
              />
            </LinearGradient>
          </View>
          <Text style={styles.emptyTitle}>No pending requests</Text>
          <Text style={styles.emptySubtitle}>
            When someone sends you a connection request, it'll appear here.
            You can also discover new people to connect with.
          </Text>
          <Pressable
            onPress={() => {
              router.back();
              setTimeout(() => {
                router.push("/(app)/find-people" as any);
              }, 300);
            }}
            style={({ pressed }) => [
              styles.discoverButton,
              pressed && { opacity: 0.85 },
            ]}
          >
            <LinearGradient
              colors={["#6C3CE0", "#E04882"]}
              style={styles.discoverButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="compass-outline" size={18} color="#FFFFFF" />
              <Text style={styles.discoverButtonText}>Find People</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <Animated.View entering={FadeIn.duration(300)}>
              <Text style={styles.sectionHeader}>{section.title}</Text>
            </Animated.View>
          )}
          renderItem={({ item, index, section }) => {
            if (section.type === "incoming") {
              const req = item as IncomingRequest;
              return (
                <IncomingRequestCard
                  request={req}
                  index={index}
                  isAccepting={acceptingId === req.id}
                  isDeclining={decliningId === req.id}
                  onPress={() =>
                    router.push(`/(app)/user/${req.sender.id}` as any)
                  }
                  onAccept={() => {
                    setAcceptingId(req.id);
                    acceptMutation.mutate({ requestId: req.id });
                  }}
                  onDecline={() => {
                    setDecliningId(req.id);
                    declineMutation.mutate({ requestId: req.id });
                  }}
                />
              );
            }
            const req = item as OutgoingRequest;
            return (
              <OutgoingRequestCard
                request={req}
                index={index}
                isCancelling={cancellingId === req.id}
                onPress={() =>
                  router.push(`/(app)/user/${req.receiver.id}` as any)
                }
                onCancel={() => {
                  setCancellingId(req.id);
                  cancelMutation.mutate({ requestId: req.id });
                }}
              />
            );
          }}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          refreshing={isRefetchingIncoming || isRefetchingOutgoing}
          onRefresh={handleRefresh}
          SectionSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
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
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  headerCountBadge: {
    backgroundColor: "#E04882",
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 7,
  },
  headerCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.45)",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 12,
    marginTop: 8,
  },

  requestCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 12,
  },
  requestCardPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  requestCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  requestInfo: {
    flex: 1,
    gap: 2,
  },
  requestName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.1,
  },
  requestTime: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.35)",
  },

  messageContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.55)",
    lineHeight: 20,
    fontStyle: "italic",
  },

  requestActions: {
    flexDirection: "row",
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#6C3CE0",
    paddingVertical: 11,
    borderRadius: 12,
  },
  acceptButtonPressed: {
    backgroundColor: "#5A2FCB",
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  declineButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  declineButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.5)",
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  outgoingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    gap: 12,
  },
  outgoingCardPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },
  outgoingAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  outgoingInitials: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  outgoingInfo: {
    flex: 1,
    gap: 2,
  },
  outgoingName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.1,
  },
  outgoingMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  outgoingTime: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.3)",
  },
  cancelChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  cancelChipPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  cancelChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.5)",
  },

  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    gap: 14,
  },
  emptyIconWrapper: {
    marginBottom: 4,
  },
  emptyIconGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.4)",
    textAlign: "center",
    lineHeight: 22,
  },
  discoverButton: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 6,
  },
  discoverButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  discoverButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
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
