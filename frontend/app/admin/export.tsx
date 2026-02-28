import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { executeExport } from '../admin/export-handler'; 
import { adminRepository } from '@/repositories/tabs/AdminRepository'; // Import the repository

export default function ExportScreen() {
  const { format } = useLocalSearchParams<{ format: 'csv' | 'txt' | 'xlsx' | 'pdf' }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Initializing...");

  useEffect(() => {
    const runExport = async () => {
      if (!format) return;

      try {
        // 1. Fetch Real Data & Calculate Analytics
        setStatus("Fetching records...");
        const data = await adminRepository.getExportData();

        // 2. Generate & Share
        setStatus(`Generating ${format.toUpperCase()} file...`);
        await executeExport(format, data);

        // 3. Close screen on success
        if (router.canGoBack()) router.back();
        
      } catch (err: any) {
        console.error("Export Error:", err);
        Alert.alert("Export Failed", err?.message || "Could not generate file.");
        setLoading(false);
      }
    };

    runExport();
  }, [format]);

  return (
    <View style={styles.container}>
      {loading && (
        <>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.text}>{status}</Text>
          <Text style={styles.subText}>Please wait...</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#fff' 
  },
  text: { 
    marginTop: 20, 
    fontSize: 16, 
    color: '#0f172a', 
    fontWeight: '700' 
  },
  subText: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
  }
});