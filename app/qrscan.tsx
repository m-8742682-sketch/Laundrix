/**
 * Deep Link Handler for QR Scan
 * 
 * URL: laundrix://qrscan?machineId=M001
 * Redirects to actual QR scan screen
 */

import { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

export default function QRScanDeepLinkHandler() {
  const { machineId } = useLocalSearchParams<{ machineId: string }>();

  useEffect(() => {
    if (machineId) {
      // Redirect to actual QR scan screen with machineId pre-filled
      router.replace({
        pathname: "/iot/qrscan",
        params: { machineId }
      });
    } else {
      // No machineId, go to main QR scan
      router.replace("/iot/qrscan");
    }
  }, [machineId]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#6366F1", "#4F46E5"]}
        style={StyleSheet.absoluteFill}
      />
      <ActivityIndicator size="large" color="#fff" />
      <Text style={styles.text}>Opening Laundrix...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 20,
  },
});