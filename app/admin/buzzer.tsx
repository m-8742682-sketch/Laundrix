import { Alert, Button, View, ActivityIndicator } from "react-native";
import { useState } from "react";
import { ref, update } from "firebase/database";
import { rtdb } from "@/services/firebase"; // 👈 RTDB export

const MACHINE_ID = "M001";

export default function BuzzerScreen() {
  const [loading, setLoading] = useState(false);

  const confirmStop = () => {
    Alert.alert(
      "Force stop buzzer?",
      "This will immediately stop the machine buzzer.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop buzzer",
          style: "destructive",
          onPress: stopBuzzer,
        },
      ]
    );
  };

  const stopBuzzer = async () => {
    try {
      setLoading(true);

      const machineRef = ref(rtdb, `iot/${MACHINE_ID}`);

      await update(machineRef, {
        buzzerState: false,
        lastPing: Date.now(), // ✅ number (matches your DB)
      });

      Alert.alert("Success", "Buzzer stopped");
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.message ?? "Failed to stop buzzer"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 16 }}>
      {loading ? (
        <ActivityIndicator size="large" color="red" />
      ) : (
        <Button
          title="FORCE STOP BUZZER"
          color="red"
          onPress={confirmStop}
        />
      )}
    </View>
  );
}
