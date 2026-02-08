import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { useUser } from "@/components/UserContext";
import { getFirestore, collection, query, where, onSnapshot } from "firebase/firestore";

export default function TabsLayout() {
  const { user } = useUser();
  const [unreadCount, setUnreadCount] = useState(0);

  // Subscribe to unread notifications count
  useEffect(() => {
    if (!user?.uid) {
      setUnreadCount(0);
      return;
    }

    const db = getFirestore();
    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      where("read", "==", false)
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      setUnreadCount(snapshot.docs.length);
    });

    return unsubscribe;
  }, [user?.uid]);

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
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case "dashboard":
              iconName = focused ? "home" : "home-outline";
              break;
            case "queue":
              iconName = focused ? "time" : "time-outline";
              break;
            case "conversations":
              iconName = focused ? "chatbubbles" : "chatbubbles-outline";
              break;
            case "history":
              iconName = focused ? "list" : "list-outline";
              break;
            case "settings":
              iconName = focused ? "settings" : "settings-outline";
              break;
            case "notifications":
              iconName = focused ? "notifications" : "notifications-outline";
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
      
      {/* 💬 Conversations/Chats tab */}
      <Tabs.Screen 
        name="conversations"
        options={{
          title: "Chats",
        }}
      />

      {/* 📝 History tab */}
      <Tabs.Screen name="history" />

      {/* 🔔 Notifications with badge */}
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: "#ef4444",
            color: "#ffffff",
            fontSize: 10,
            fontWeight: "600",
          },
        }}
      />

      <Tabs.Screen name="settings" />
      
      {/* Hidden screens (accessed via navigation, not shown in tab bar) */}
      <Tabs.Screen 
        name="contact" 
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
