import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";

import { queryClient, trpc } from "~/utils/api";
import { authClient } from "~/utils/auth";

import "../styles.css";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const segments = useSegments();
  const router = useRouter();

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    ...trpc.user.getMe.queryOptions(),
    enabled: !!session,
  });

  useEffect(() => {
    if (isPending) return;

    const inAuthGroup = segments[0] === ("(auth)" as string);
    const inOnboardingGroup = segments[0] === ("(onboarding)" as string);

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/sign-in" as any);
      return;
    }

    if (session && inAuthGroup) {
      // Don't navigate until we know onboarding status
      if (isProfileLoading) return;

      if (profile && !profile.onboardingCompleted) {
        router.replace("/(onboarding)" as any);
      } else {
        router.replace("/(app)" as any);
      }
      return;
    }

    if (session && !inAuthGroup && !inOnboardingGroup) {
      if (isProfileLoading) return;
      if (profile && !profile.onboardingCompleted) {
        router.replace("/(onboarding)" as any);
      }
    }

    if (session && inOnboardingGroup) {
      if (isProfileLoading) return;
      if (profile && profile.onboardingCompleted) {
        router.replace("/(app)" as any);
      }
    }
  }, [session, isPending, segments, profile, isProfileLoading]);

  if (isPending) return null;
  if (session && isProfileLoading) return null;

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
