import { Stack } from "expo-router";

export default function AppLayout() {
  return (
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
        name="event/[id]"
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
    </Stack>
  );
}
