import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,

        // 🎨 Colors
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#111827",

        // 📱 Better spacing for gesture bar
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 0,
          height: 72,
          paddingBottom: 16,
          paddingTop: 10,
        },

        // 🔵 Floating active indicator (rounded touch area)
        tabBarItemStyle: {
          borderRadius: 12,
        },

        // 🎯 Icons
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: any;

          switch (route.name) {
            case "dashboard":
              iconName = focused ? "home" : "home-outline";
              break;
            case "queue":
              iconName = focused ? "time" : "time-outline";
              break;
            case "history":
              iconName = focused ? "list" : "list-outline";
              break;
            case "settings":
              iconName = focused ? "settings" : "settings-outline";
              break;
            case "notifications":
              iconName = focused
                ? "notifications"
                : "notifications-outline";
              break;
            default:
              iconName = "ellipse";
          }

          return <Ionicons name={iconName} size={24} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="dashboard" />
      
      <Tabs.Screen name="queue" />
      <Tabs.Screen
        name="contact"
        options={{
          href: null,        // 👈 hides from tab bar
        }}
      />
      <Tabs.Screen name="history" />

      {/* 🔔 Notifications with badge */}
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarBadge: 3,
          tabBarBadgeStyle: {
            backgroundColor: "#ef4444",
            color: "#ffffff",
            fontSize: 10,
            fontWeight: "600",
          },
        }}
      />

      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
