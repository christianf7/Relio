import { useColorScheme } from "react-native";
import { Stack } from "expo-router";

export default function AppLayout() {
  const colorScheme = useColorScheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colorScheme === "dark" ? "#0A0A1A" : "#F8F7FC",
        },
        headerTintColor: colorScheme === "dark" ? "#FFFFFF" : "#1A0A2E",
        headerTitleStyle: {
          fontWeight: "600",
        },
        contentStyle: {
          backgroundColor: colorScheme === "dark" ? "#0A0A1A" : "#F8F7FC",
        },
      }}
    />
  );
}
