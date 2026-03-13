import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "~/utils/api";
import { authClient } from "~/utils/auth";

import "../styles.css";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;

    const inAuthGroup = segments[0] === ("(auth)" as string);

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/sign-in" as any);
    } else if (session && inAuthGroup) {
      router.replace("/(app)" as any);
    }
  }, [session, isPending, segments]);

  if (isPending) return null;

  return <>{children}</>;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <Slot />
      </AuthGate>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </QueryClientProvider>
  );
}
