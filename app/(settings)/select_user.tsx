/**
 * Select User Screen
 * 
 * Displays a list of all users to start a new chat conversation.
 * Excludes the current user from the list.
 */

import React, { useEffect, useState, useCallback, memo } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
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

// Memoized user item for performance
const UserListItem = memo(({ 
  item, 
  onPress 
}: { 
  item: UserItem; 
  onPress: () => void;
}) => (
  <Pressable 
    style={({ pressed }) => [
      styles.userItem,
      pressed && styles.userItemPressed,
    ]}
    onPress={onPress}
  >
    <Avatar 
      {...resolveAvatar({ name: item.name, avatarUrl: item.avatarUrl })} 
      size={50} 
    />
    <View style={styles.userInfo}>
      <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
    </View>
    <Ionicons name="chatbubble-outline" size={22} color="#0EA5E9" />
  </Pressable>
));

export default function SelectUserScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, "users"));
        const usersList: UserItem[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          // Exclude current user
          if (doc.id !== user?.uid) {
            usersList.push({
              id: doc.id,
              name: data.name || data.displayName || "Unknown",
              email: data.email || "",
              avatarUrl: data.avatarUrl || data.photoURL,
            });
          }
        });
        
        // Sort alphabetically
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
    return (
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
    );
  });

  const handleUserSelect = useCallback((selectedUser: UserItem) => {
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
    <UserListItem 
      item={item} 
      onPress={() => handleUserSelect(item)} 
    />
  ), [handleUserSelect]);

  const keyExtractor = useCallback((item: UserItem) => item.id, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading users...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Background Decor */}
      <View style={styles.backgroundDecor}>
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
      </View>

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#0EA5E9" />
        </Pressable>
        <Text style={styles.title}>New Chat</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      {/* Search Bar */}
      <Animated.View style={[styles.searchContainer, { opacity: fadeAnim }]}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
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
        contentContainerStyle={[
          styles.listContent,
          filteredUsers.length === 0 && styles.emptyListContent,
        ]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={15}
        windowSize={10}
        initialNumToRender={15}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={["#f0f9ff", "#e0f2fe"]}
              style={styles.emptyIconContainer}
            >
              <Ionicons name="people-outline" size={48} color="#0EA5E9" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>
              {searchQuery ? "No users found" : "No users available"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery 
                ? "Try a different search term" 
                : "There are no other users to chat with yet"}
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
  loadingText: {
    marginTop: 12,
    color: "#64748b",
    fontSize: 14,
    fontWeight: "500",
  },
  backgroundDecor: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  decorCircle1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#E0F2FE",
    opacity: 0.5,
    top: -50,
    right: -50,
  },
  decorCircle2: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#BAE6FD",
    opacity: 0.3,
    bottom: 100,
    left: -40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f0f9ff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#0f172a",
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
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  userItemPressed: {
    backgroundColor: "#f8fafc",
    transform: [{ scale: 0.98 }],
  },
  userInfo: {
    flex: 1,
    marginLeft: 14,
  },
  userName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 13,
    color: "#64748b",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 20,
  },
});
