import React, { useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ScrollView,
} from "react-native";
import { EMOJI_CATEGORIES } from "../../emoji-data";

const NUM_COLUMNS = 8;

export default function EmojiPicker({
  onSelect,
}: {
  onSelect: (emoji: string) => void;
}) {
  const categoryKeys = Object.keys(
    EMOJI_CATEGORIES
  ) as Array<keyof typeof EMOJI_CATEGORIES>;

  const [activeCategory, setActiveCategory] = useState<
    keyof typeof EMOJI_CATEGORIES
  >(categoryKeys[0]);

  // 🔥 Emoji list for current category
  const emojis = useMemo(
    () => EMOJI_CATEGORIES[activeCategory].emojis,
    [activeCategory]
  );

  return (
    <View style={styles.container}>
      {/* CATEGORY BAR */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryBar}
      >
        {categoryKeys.map((key) => {
          const cat = EMOJI_CATEGORIES[key];
          const active = key === activeCategory;

          return (
            <Pressable
              key={key}
              onPress={() => setActiveCategory(key)}
              style={styles.categoryBtn}
            >
              <Ionicons
                name={active ? cat.icon.active : cat.icon.inactive}
                size={22}
                color={active ? "#0EA5E9" : "#94A3B8"}
              />
              {active && <View style={styles.activeDot} />}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* EMOJI GRID (VERTICAL SCROLL) */}
      <FlatList
        data={emojis}
        keyExtractor={(item) => item}
        numColumns={NUM_COLUMNS}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.emojiGrid}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelect(item)}
            style={styles.emojiBtn}
          >
            <Text style={styles.emoji}>{item}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 320,
    backgroundColor: "#fff",
  },

  categoryBar: {
    height: 44,
    paddingHorizontal: 8,
    alignItems: "center",
  },

  categoryBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },

  activeDot: {
    marginTop: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0EA5E9",
  },

  emojiGrid: {
    paddingTop: 8,
    paddingBottom: 16,
  },

  emojiBtn: {
    flex: 1,
    alignItems: "center",
    marginVertical: 10,
  },

  emoji: {
    fontSize: 24,
  },
});