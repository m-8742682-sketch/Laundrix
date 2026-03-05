import { Tabs, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState, useRef } from "react";
import { useUser } from "@/components/UserContext";
import { useI18n } from "@/i18n/i18n";
import { getFirestore, collection, query, where, onSnapshot } from "firebase/firestore";
import { View, StyleSheet, Animated, Dimensions, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export default function TabsLayout() {
  const { user } = useUser();
  const { t } = useI18n();
  const [unreadCount, setUnreadCount] = useState(0);
  const isAdmin = user?.role === "admin";
  const pathname = usePathname();

  // Hide tab bar on contact page
  const isContactPage = pathname?.includes("/contact");

  const slideAnim = useRef(new Animated.Value(100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
    <View style={styles.container}>
      <Tabs
        backBehavior="history"
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          // Each tab keeps its own navigation history — back button works within a tab
          lazy: true,

          tabBarActiveTintColor: "#6366F1",
          tabBarInactiveTintColor: "#94A3B8",

          // Hide tab bar on contact page
          tabBarStyle: {
            position: "absolute",
            bottom: isContactPage ? -100 : 24, // Move off screen when hidden
            height: 76,
            width: width - 32,
            marginHorizontal: 16,
            alignSelf: "center",

            backgroundColor: "rgba(255, 255, 255, 0.75)",
            borderRadius: 24,
            elevation: 0,
            shadowColor: "#6366F1",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
            borderTopWidth: 0,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.6)",
            paddingBottom: 8,
            paddingTop: 8,
            
            // Alternative: use display none (but animation won't work)
            // display: isContactPage ? "none" : "flex",
            
            opacity: isContactPage ? 0 : 1,
            transform: [{ translateY: isContactPage ? 100 : 0 }],
          },

          tabBarItemStyle: {
            height: 60,
            marginTop: 0,
            paddingBottom: 0,
            justifyContent: "center",
          },

          tabBarLabelStyle: styles.tabBarLabel,

          tabBarBackground: () => (
            <View style={styles.tabBarBlur}>
              <LinearGradient
                colors={[
                  "rgba(238, 242, 255, 0.92)",
                  "rgba(245, 243, 255, 0.92)",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            </View>
          ),

          tabBarIcon: ({ color, size, focused }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            switch (route.name) {
              case "dashboard":     iconName = focused ? "home"          : "home-outline"; break;
              case "queue":         iconName = focused ? "time"          : "time-outline"; break;
              case "conversations": iconName = focused ? "chatbubbles"   : "chatbubbles-outline"; break;
              case "history":       iconName = focused ? "list"          : "list-outline"; break;
              case "notifications": iconName = focused ? "notifications" : "notifications-outline"; break;
              case "admin":         iconName = focused ? "shield"        : "shield-outline"; break;
              case "settings":      iconName = focused ? "settings"      : "settings-outline"; break;
              default:              iconName = "ellipse";
            }

            return (
              <View style={styles.iconWrapper}>
                {focused ? (
                  <LinearGradient
                    colors={["#6366F1", "#8B5CF6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.activeIconContainer}
                  >
                    <Ionicons name={iconName} size={20} color="#FFFFFF" />
                    <View style={styles.shine} />
                  </LinearGradient>
                ) : (
                  <View style={styles.iconContainer}>
                    <Ionicons name={iconName} size={20} color={color} />
                  </View>
                )}

                {route.name === "notifications" && unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            );
          },
        })}
      >
        <Tabs.Screen name="dashboard"     options={{ title: t.tabHome }} />
        <Tabs.Screen name="queue"         options={{ title: t.tabQueue }} />
        <Tabs.Screen name="conversations" options={{ title: t.tabChats }} />
        <Tabs.Screen name="history"       options={{ title: t.tabHistory }} />
        <Tabs.Screen name="notifications" options={{ title: t.tabNotif }} />
        <Tabs.Screen name="admin"         options={{ title: t.tabAdmin, href: isAdmin ? "/admin" : null }} />
        <Tabs.Screen name="settings"      options={{ title: t.tabSettings }} />
        <Tabs.Screen 
          name="contact"       
          options={{ 
            href: null,
            // This ensures contact page has no tab bar
            tabBarStyle: { display: 'none' }
          }} 
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  tabBarBlur: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },

  tabBarLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
    marginBottom: 0,
    lineHeight: 12,
    letterSpacing: 0.3,
    includeFontPadding: false,
    textAlignVertical: "center",
    minWidth: 50,
  },

  iconWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },

  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  activeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },

  shine: {
    position: "absolute",
    top: -10,
    left: -10,
    width: 24,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 12,
    transform: [{ rotate: "45deg" }],
  },

  badge: {
    position: "absolute",
    top: -2,
    right: -6,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "700",
  },
});