import { View, Text, Button } from "react-native";
import { router } from "expo-router";

export default function AdminDashboard() {
  return (
    <View style={{ padding: 16 }}>
      <Text>Admin Dashboard</Text>
      <Button
        title="Buzzer Control"
        onPress={() => router.push("/admin/buzzer")}
      />
    </View>
  );
}
