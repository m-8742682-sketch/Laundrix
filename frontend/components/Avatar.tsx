import { View, Text, Image } from "react-native";

/* ---------- HELPERS ---------- */

const getInitials = (name?: string | null) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const stringToColor = (str?: string | null) => {
  if (!str) return "#94a3b8";

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const colors = [
    "#2563eb", // blue
    "#7c3aed", // violet
    "#db2777", // pink
    "#16a34a", // green
    "#d97706", // amber
    "#0891b2", // cyan
  ];

  return colors[Math.abs(hash) % colors.length];
};

/* ---------- COMPONENT ---------- */

type AvatarProps = {
  name?: string | null;
  avatarUrl?: string | null;
  size?: number;
};

export default function Avatar({
  name,
  avatarUrl,
  size = 40,
}: AvatarProps) {
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        onError={() => {
          /* silently fall back to initials */
        }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: stringToColor(name),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: "#ffffff",
          fontWeight: "700",
          fontSize: size * 0.4,
        }}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
}

/* ---------- AVATAR RESOLVER ---------- */

export const resolveAvatar = (
  params: {
    name?: string | null;
    avatarUrl?: string | null;
  }
) => {
  return {
    name: params.name ?? undefined,
    avatarUrl: params.avatarUrl ?? null,
  };
};