import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
  Icon,
  Label,
  NativeTabs,
  VectorIcon,
} from "expo-router/unstable-native-tabs";

import { trpc } from "~/utils/api";

export default function TabsLayout() {
  const { data: profile } = useQuery(trpc.user.getMe.queryOptions());
  const pendingCount =
    (profile as { pendingRequestCount?: number } | null | undefined)
      ?.pendingRequestCount ?? 0;

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon
          sf={{ default: "house", selected: "house.fill" }}
          androidSrc={<VectorIcon family={Ionicons} name="home" />}
        />
        <Label>Home</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="people">
        <Icon
          sf={{ default: "person.2", selected: "person.2.fill" }}
          androidSrc={<VectorIcon family={Ionicons} name="people" />}
        />
        <Label>People</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="scan">
        <Icon
          sf="qrcode.viewfinder"
          androidSrc={<VectorIcon family={Ionicons} name="scan" />}
        />
        <Label>Scan</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="events">
        <Icon
          sf="calendar"
          androidSrc={<VectorIcon family={Ionicons} name="calendar" />}
        />
        <Label>Events</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Icon
          sf={{ default: "person", selected: "person.fill" }}
          androidSrc={<VectorIcon family={Ionicons} name="person" />}
        />
        <Label>Profile</Label>
        <Badge hidden={pendingCount === 0}>
          {pendingCount > 0 ? String(pendingCount) : undefined}
        </Badge>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
