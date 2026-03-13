import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Icon,
  Label,
  NativeTabs,
  VectorIcon,
} from "expo-router/unstable-native-tabs";

export default function TabsLayout() {
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
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
