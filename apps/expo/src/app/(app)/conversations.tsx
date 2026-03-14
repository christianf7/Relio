import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";

import FloatingOrbs from "~/components/FloatingOrbs";
import { trpc } from "~/utils/api";

const AVATAR_GRADIENTS: [string, string][] = [
  ["#6C3CE0", "#E04882"],
  ["#4880E0", "#11998E"],
  ["#E04882", "#FD746C"],
  ["#11998E", "#26D0CE"],
  ["#2D1B69", "#6C3CE0"],
  ["#4A1942", "#E04882"],
];

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
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

function getGradientForId(id: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]!;
}

type Conversation = {
  otherUser: {
    id: string;
    name: string;
    displayName: string | null;
    image: string | null;
  };
  lastMessage: string;
  lastMessageAt: Date | string;
  lastMessageSenderId: string;
  unreadCount: number;
};

function ConversationRow({
  conversation,
  index,
  onPress,
}: {
  conversation: Conversation;
  index: number;
  onPress: () => void;
}) {
  const user = conversation.otherUser;
  const name = user.displayName ?? user.name;
  const gradient = getGradientForId(user.id);
  const hasUnread = conversation.unreadCount > 0;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40)
        .springify()
        .damping(18)}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.conversationRow,
          pressed && styles.conversationRowPressed,
          hasUnread && styles.conversationRowUnread,
        ]}
      >
        <View style={styles.avatarContainer}>
          {user.image ? (
            <Image source={{ uri: user.image }} style={styles.avatar} />
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
          {hasUnread && <View style={styles.unreadDot} />}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text
              style={[styles.conversationName, hasUnread && styles.textBold]}
              numberOfLines={1}
            >
              {name}
            </Text>
            <Text
              style={[
                styles.conversationTime,
                hasUnread && styles.conversationTimeUnread,
              ]}
            >
              {timeAgo(conversation.lastMessageAt)}
            </Text>
          </View>
          <Text
            style={[
              styles.conversationPreview,
              hasUnread && styles.conversationPreviewUnread,
            ]}
            numberOfLines={1}
          >
            {conversation.lastMessage}
          </Text>
        </View>

        {hasUnread && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>
              {conversation.unreadCount > 99
                ? "99+"
                : conversation.unreadCount}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function ConversationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const {
    data: conversations,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    ...trpc.message.getConversations.queryOptions(),
    refetchInterval: 5000,
  });

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6C3CE0" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FloatingOrbs opacity={0.4} />

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
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ width: 44 }} />
      </View>

      {!conversations || conversations.length === 0 ? (
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
                name="chatbubbles-outline"
                size={44}
                color="rgba(108, 60, 224, 0.6)"
              />
            </LinearGradient>
          </View>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySubtitle}>
            Start a conversation by visiting a connection's profile and tapping
            the Message button.
          </Text>
        </Animated.View>
      ) : (
        <FlatList
          data={conversations as Conversation[]}
          renderItem={({ item, index }) => (
            <ConversationRow
              conversation={item}
              index={index}
              onPress={() =>
                router.push(`/(app)/dm/${item.otherUser.id}` as any)
              }
            />
          )}
          keyExtractor={(item) => item.otherUser.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor="#6C3CE0"
            />
          }
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
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    textAlign: "center",
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 2,
    borderRadius: 16,
    gap: 14,
  },
  conversationRowPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  conversationRowUnread: {
    backgroundColor: "rgba(108, 60, 224, 0.06)",
  },

  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    fontSize: 19,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  unreadDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#6C3CE0",
    borderWidth: 2.5,
    borderColor: "#0A0A1A",
  },

  conversationContent: {
    flex: 1,
    gap: 4,
  },
  conversationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  conversationName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
    letterSpacing: -0.1,
  },
  textBold: {
    fontWeight: "700",
  },
  conversationTime: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.3)",
  },
  conversationTimeUnread: {
    color: "#6C3CE0",
    fontWeight: "600",
  },
  conversationPreview: {
    fontSize: 14,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.35)",
    lineHeight: 20,
  },
  conversationPreviewUnread: {
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: "500",
  },

  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#6C3CE0",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
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
});
