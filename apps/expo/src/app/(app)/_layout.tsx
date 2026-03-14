import { View } from "react-native";
import { Stack } from "expo-router";

import { InAppNotificationProvider } from "~/components/InAppNotifications";
import { OnboardingTooltipOverlay } from "~/components/OnboardingTooltip";

export default function AppLayout() {
  return (
    <InAppNotificationProvider>
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#0A0A1A" },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="create-event"
            options={{
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="edit-profile"
            options={{
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="find-people"
            options={{
              animation: "slide_from_bottom",
              presentation: "modal",
            }}
          />
          <Stack.Screen
            name="event/[id]"
            options={{
              presentation: "modal",
              animation: "slide_from_bottom",
            }}
          />
          <Stack.Screen
            name="user/[id]"
            options={{
              presentation: "modal",
              animation: "slide_from_bottom",
            }}
          />
          <Stack.Screen
            name="connection-requests"
            options={{
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="conversations"
            options={{
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="dm/[id]"
            options={{
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="event-chat/[id]"
            options={{
              animation: "slide_from_right",
            }}
          />
        </Stack>
        <OnboardingTooltipOverlay />
      </View>
    </InAppNotificationProvider>
  );
}
