import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutUp,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { usePathname, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

type NotificationType = "connection_request" | "new_connection" | "new_message";

interface InAppNotification {
  id: string;
  type: NotificationType;
  title: string;
  subtitle: string;
  navigateTo: string;
  timestamp: number;
}

type IncomingRequest =
  RouterOutputs["connection"]["getIncomingRequests"][number];
type Connection = RouterOutputs["connection"]["getConnections"][number];
type Conversation = RouterOutputs["message"]["getConversations"][number];

const POLL_INTERVAL = 5000;
const TOAST_DURATION = 4000;
const TOAST_SHOW_DELAY = 600;

const ICON_MAP: Record<
  NotificationType,
  { name: keyof typeof Ionicons.glyphMap; colors: [string, string] }
> = {
  connection_request: {
    name: "person-add",
    colors: ["#6C3CE0", "#E04882"],
  },
  new_connection: {
    name: "people",
    colors: ["#11998E", "#26D0CE"],
  },
  new_message: {
    name: "chatbubble",
    colors: ["#4880E0", "#6C3CE0"],
  },
};

const NotificationContext = createContext<null>(null);

function NotificationToast({
  notification,
  onDismiss,
}: {
  notification: InAppNotification;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const iconConfig = ICON_MAP[notification.type];

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const timer = setTimeout(onDismiss, TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handlePress = () => {
    onDismiss();
    router.push(notification.navigateTo as any);
  };

  return (
    <Animated.View
      entering={SlideInUp.springify().damping(20).stiffness(200)}
      exiting={SlideOutUp.duration(250)}
      style={[styles.toastOuter, { top: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.toastContainer,
          pressed && styles.toastPressed,
        ]}
      >
        <LinearGradient
          colors={iconConfig.colors}
          style={styles.accentBar}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />

        <View style={styles.toastIconWrap}>
          <LinearGradient
            colors={iconConfig.colors}
            style={styles.toastIconBg}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name={iconConfig.name} size={18} color="#FFFFFF" />
          </LinearGradient>
        </View>

        <View style={styles.toastTextWrap}>
          <Text style={styles.toastTitle} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.toastSubtitle} numberOfLines={1}>
            {notification.subtitle}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={16}
          color="rgba(255,255,255,0.3)"
          style={styles.toastChevron}
        />
      </Pressable>
    </Animated.View>
  );
}

export function InAppNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const userId = session?.user?.id;

  const [queue, setQueue] = useState<InAppNotification[]>([]);
  const [currentToast, setCurrentToast] = useState<InAppNotification | null>(
    null,
  );

  const prevRequestIdsRef = useRef<Set<string> | null>(null);
  const prevConnectionIdsRef = useRef<Set<string> | null>(null);
  const prevConversationsRef = useRef<
    Map<string, { lastMessageAt: number; lastMessageSenderId: string }> | null
  >(null);
  const isInitializedRef = useRef(false);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const enqueueNotification = useCallback((notif: InAppNotification) => {
    setQueue((prev) => [...prev, notif]);
  }, []);

  useEffect(() => {
    if (currentToast || queue.length === 0) return;

    const timer = setTimeout(() => {
      setCurrentToast(queue[0]!);
      setQueue((prev) => prev.slice(1));
    }, TOAST_SHOW_DELAY);

    return () => clearTimeout(timer);
  }, [queue, currentToast]);

  const dismissToast = useCallback(() => {
    setCurrentToast(null);
  }, []);

  const poll = useCallback(async () => {
    if (!userId) return;

    try {
      const [requests, connections, conversations] = await Promise.all([
        queryClient.fetchQuery(
          trpc.connection.getIncomingRequests.queryOptions(),
        ),
        queryClient.fetchQuery(trpc.connection.getConnections.queryOptions()),
        queryClient.fetchQuery(trpc.message.getConversations.queryOptions()),
      ]);

      const currentRequestIds = new Set(
        (requests as IncomingRequest[]).map((r) => r.id),
      );
      const currentConnectionIds = new Set(
        (connections as Connection[]).map((c) => c.id),
      );
      const currentConversations = new Map(
        (conversations as Conversation[]).map((c) => [
          c.otherUser.id,
          {
            lastMessageAt: new Date(c.lastMessageAt).getTime(),
            lastMessageSenderId: c.lastMessageSenderId,
            otherUserName: c.otherUser.displayName ?? c.otherUser.name,
            lastMessage: c.lastMessage,
          },
        ]),
      );

      if (!isInitializedRef.current) {
        prevRequestIdsRef.current = currentRequestIds;
        prevConnectionIdsRef.current = currentConnectionIds;
        prevConversationsRef.current = new Map(
          [...currentConversations.entries()].map(([k, v]) => [
            k,
            {
              lastMessageAt: v.lastMessageAt,
              lastMessageSenderId: v.lastMessageSenderId,
            },
          ]),
        );
        isInitializedRef.current = true;
        return;
      }

      if (prevRequestIdsRef.current) {
        for (const req of requests as IncomingRequest[]) {
          if (!prevRequestIdsRef.current.has(req.id)) {
            const name = req.sender.displayName ?? req.sender.name;
            enqueueNotification({
              id: `req-${req.id}`,
              type: "connection_request",
              title: "New Connection Request",
              subtitle: `${name} wants to connect with you`,
              navigateTo: "/(app)/connection-requests",
              timestamp: Date.now(),
            });
          }
        }
      }

      if (prevConnectionIdsRef.current) {
        for (const conn of connections as Connection[]) {
          if (!prevConnectionIdsRef.current.has(conn.id)) {
            const name = conn.displayName ?? conn.name;
            enqueueNotification({
              id: `conn-${conn.id}`,
              type: "new_connection",
              title: "New Connection",
              subtitle: `You and ${name} are now connected`,
              navigateTo: `/(app)/user/${conn.id}`,
              timestamp: Date.now(),
            });
          }
        }
      }

      if (prevConversationsRef.current) {
        for (const [otherUserId, conv] of currentConversations) {
          const prev = prevConversationsRef.current.get(otherUserId);
          const isNewOrUpdated =
            !prev || conv.lastMessageAt > prev.lastMessageAt;
          const isFromOther = conv.lastMessageSenderId !== userId;
          const isViewingThisDm =
            pathnameRef.current === `/dm/${otherUserId}` ||
            pathnameRef.current === `/(app)/dm/${otherUserId}`;

          if (isNewOrUpdated && isFromOther && !isViewingThisDm) {
            const preview =
              conv.lastMessage.length > 50
                ? conv.lastMessage.slice(0, 50) + "..."
                : conv.lastMessage;
            enqueueNotification({
              id: `msg-${otherUserId}-${conv.lastMessageAt}`,
              type: "new_message",
              title: conv.otherUserName,
              subtitle: preview,
              navigateTo: `/(app)/dm/${otherUserId}`,
              timestamp: Date.now(),
            });
          }
        }
      }

      prevRequestIdsRef.current = currentRequestIds;
      prevConnectionIdsRef.current = currentConnectionIds;
      prevConversationsRef.current = new Map(
        [...currentConversations.entries()].map(([k, v]) => [
          k,
          {
            lastMessageAt: v.lastMessageAt,
            lastMessageSenderId: v.lastMessageSenderId,
          },
        ]),
      );
    } catch {
      // Silently ignore polling errors
    }
  }, [userId, queryClient, enqueueNotification]);

  useEffect(() => {
    if (!userId) {
      isInitializedRef.current = false;
      prevRequestIdsRef.current = null;
      prevConnectionIdsRef.current = null;
      prevConversationsRef.current = null;
      return;
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [userId, poll]);

  return (
    <NotificationContext.Provider value={null}>
      <View style={styles.root}>
        {children}
        {currentToast && (
          <NotificationToast
            key={currentToast.id}
            notification={currentToast}
            onDismiss={dismissToast}
          />
        )}
      </View>
    </NotificationContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  toastOuter: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toastContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(22, 22, 40, 0.92)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
    paddingRight: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  toastPressed: {
    backgroundColor: "rgba(30, 30, 52, 0.95)",
    transform: [{ scale: 0.98 }],
  },
  accentBar: {
    width: 3,
    alignSelf: "stretch",
  },
  toastIconWrap: {
    marginLeft: 14,
    marginRight: 12,
  },
  toastIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  toastTextWrap: {
    flex: 1,
    paddingVertical: 14,
    gap: 2,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.1,
  },
  toastSubtitle: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.55)",
  },
  toastChevron: {
    marginLeft: 4,
  },
});
