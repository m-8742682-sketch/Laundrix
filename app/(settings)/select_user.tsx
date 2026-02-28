import React, { useEffect, useState, useCallback, memo, useRef } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  StatusBar,
  TextInput,
  Animated,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useI18n } from "@/i18n/i18n";
import { collection, getDocs } from "firebase/firestore";

import { db } from "@/services/firebase";
import { useUser } from "@/components/UserContext";
import Avatar, { resolveAvatar } from "@/components/Avatar";

interface UserItem {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

const UserListItem = memo(({ item, onPress }: { item: UserItem; onPress: () => void }) => (
  <Pressable 
    style={({ pressed }) => [styles.userItem, pressed && styles.userItemPressed]}
    onPress={onPress}
  >
    <View style={styles.avatarContainer}>
      <Avatar 
        {...resolveAvatar({ name: item.name, avatarUrl: item.avatarUrl })} 
        size={52} 
      />
    </View>
    <View style={styles.userInfo}>
      <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
    </View>
    <LinearGradient
      colors={["#22D3EE", "#06B6D4"]}
      style={styles.chatButton}
    >
      <Ionicons name="chatbubble" size={18} color="#fff" />
    </LinearGradient>
  </Pressable>
));

export default function SelectUserScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { t } = useI18n();
  
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 3000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, "users"));
        const usersList: UserItem[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (doc.id !== user?.uid) {
            usersList.push({
              id: doc.id,
              name: data.name || data.displayName || "Unknown",
              email: data.email || "",
              avatarUrl: data.avatarUrl || data.photoURL,
            });
          }
        });
        
        usersList.sort((a, b) => a.name.localeCompare(b.name));
        setUsers(usersList);
      } catch (error) {
        console.error("[SelectUser] Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [user?.uid]);

  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query);
  });

  const handleUserSelect = useCallback((selectedUser: UserItem) => {
    Keyboard.dismiss();
    router.push({
      pathname: "/(tabs)/contact",
      params: {
        targetUserId: selectedUser.id,
        targetName: selectedUser.name,
        targetAvatar: selectedUser.avatarUrl || "",
      },
    });
  }, []);

  const renderItem = useCallback(({ item }: { item: UserItem }) => (
    <UserListItem item={item} onPress={() => handleUserSelect(item)} />
  ), [handleUserSelect]);

  const keyExtractor = useCallback((item: UserItem) => item.id, []);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.backgroundDecor}>
          <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
          <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
        </View>
        <LinearGradient colors={["#22D3EE", "#06B6D4"]} style={styles.loadingIcon}>
          <Ionicons name="people" size={32} color="#fff" />
        </LinearGradient>
        <Text style={styles.loadingText}>{t.loadingUsers}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Background Decor */}
      <View style={styles.backgroundDecor}>
        <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
        <View style={styles.decorCircle3} />
      </View>

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <LinearGradient colors={["#ECFEFF", "#CFFAFE"]} style={styles.backButtonGradient}>
            <Ionicons name="chevron-back" size={24} color="#0891B2" />
          </LinearGradient>
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{t.newChatTitle}</Text>
          <Text style={styles.subtitle}>{users.length} {t.usersAvailable}</Text>
        </View>
        <View style={styles.headerPlaceholder} />
      </Animated.View>

      {/* Search Bar */}
      <Animated.View style={[styles.searchContainer, { opacity: fadeAnim }]}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder={t.searchUsersPlaceholder}
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Users List */}
      <FlatList
        data={filteredUsers}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContent, filteredUsers.length === 0 && styles.emptyListContent]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <LinearGradient colors={["#ECFEFF", "#CFFAFE"]} style={styles.emptyIconGradient}>
                <LinearGradient colors={["#22D3EE", "#06B6D4"]} style={styles.emptyIconInner}>
                  <Ionicons name="people" size={40} color="#fff" />
                </LinearGradient>
              </LinearGradient>
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery ? t.noUsersFound : t.noUsersAvailable}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? t.tryDifferentSearch : t.noOtherUsers}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    elevation: 6,
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  loadingText: {
    marginTop: 8,
    color: "#0891B2",
    fontSize: 15,
    fontWeight: "600",
  },
  backgroundDecor: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  decorCircle1: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "#CFFAFE",
    opacity: 0.4,
    top: -80,
    right: -80,
  },
  decorCircle2: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#E0E7FF",
    opacity: 0.35,
    bottom: 150,
    left: -50,
  },
  decorCircle3: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#A5F3FC",
    opacity: 0.25,
    top: "40%",
    right: -30,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    borderRadius: 14,
    overflow: "hidden",
  },
  backButtonGradient: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
    marginTop: 2,
  },
  headerPlaceholder: {
    width: 44,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#0f172a",
    fontWeight: "500",
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: "center",
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    elevation: 2,
    shadowColor: "#22D3EE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  userItemPressed: {
    backgroundColor: "#ECFEFF",
    borderColor: "#CFFAFE",
    transform: [{ scale: 0.98 }],
  },
  avatarContainer: {
    marginRight: 14,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 3,
  },
  userEmail: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  chatButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyIconGradient: {
    width: 110,
    height: 110,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  emptyIconInner: {
    width: 82,
    height: 82,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "500",
  },
});