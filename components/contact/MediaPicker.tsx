/**
 * MediaPicker — Telegram-style bottom-sheet with action buttons only.
 * Shows Camera / Gallery / Video / File — no thumbnail grid.
 */

import React, { useRef, useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { uploadMedia } from "@/services/mediaUpload.service";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useI18n } from "@/i18n/i18n";

const SHEET_HEIGHT = 240;

export type MediaType = "image" | "video" | "file";

export interface MediaAsset {
  uri: string;
  type: MediaType;
  name: string;
  size?: number;
  mimeType?: string;
  duration?: number | null;
  width?: number;
  height?: number;
  cloudinaryUrl?: string;
  publicId?: string;
}

interface MediaPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (assets: MediaAsset[]) => void;
  maxSelection?: number;
}

const MediaPicker: React.FC<MediaPickerProps> = ({ visible, onClose, onSelect }) => {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [isUploading, setIsUploading] = useState(false);
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  const close = useCallback(() => {
    Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 220, useNativeDriver: true }).start(onClose);
  }, [slideAnim, onClose]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 13, useNativeDriver: true }).start();
    }
  }, [visible]);

  const openCamera = async () => {
    close();
    await new Promise(r => setTimeout(r, 300));
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 });
    if (!r.canceled && r.assets[0]) {
      const a = r.assets[0];
      setIsUploading(true);
      try {
        const up = await uploadMedia(a.uri, "image");
        onSelect([{ uri: a.uri, type: "image", name: a.uri.split("/").pop() || "photo.jpg", width: a.width, height: a.height, cloudinaryUrl: up.secure_url, publicId: up.public_id }]);
      } catch { Alert.alert("Upload Failed"); }
      finally { setIsUploading(false); }
    }
  };

  const openGalleryPicker = async () => {
    close();
    await new Promise(r => setTimeout(r, 300));
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: 10, quality: 0.85 });
    if (!r.canceled && r.assets.length > 0) {
      setIsUploading(true);
      try {
        const uploaded = await Promise.all(r.assets.map(async (a) => {
          const up = await uploadMedia(a.uri, "image");
          return { uri: a.uri, type: "image" as MediaType, name: a.uri.split("/").pop() || "photo.jpg", width: a.width, height: a.height, cloudinaryUrl: up.secure_url, publicId: up.public_id };
        }));
        onSelect(uploaded);
      } catch { Alert.alert("Upload Failed"); }
      finally { setIsUploading(false); }
    }
  };

  const openVideoPicker = async () => {
    close();
    await new Promise(r => setTimeout(r, 300));
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 0.85, videoMaxDuration: 300 });
    if (!r.canceled && r.assets[0]) {
      const a = r.assets[0];
      setIsUploading(true);
      try {
        const up = await uploadMedia(a.uri, "video");
        onSelect([{ uri: a.uri, type: "video", name: a.uri.split("/").pop() || "video.mp4", duration: a.duration, cloudinaryUrl: up.secure_url, publicId: up.public_id }]);
      } catch { Alert.alert("Upload Failed"); }
      finally { setIsUploading(false); }
    }
  };

  const openFilePicker = async () => {
    close();
    await new Promise(r => setTimeout(r, 300));
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (!r.canceled && r.assets[0]) {
        const f = r.assets[0];
        setIsUploading(true);
        try {
          const up = await uploadMedia(f.uri, "file");
          onSelect([{ uri: f.uri, type: "file", name: f.name, size: f.size, mimeType: f.mimeType || "application/octet-stream", cloudinaryUrl: up.secure_url, publicId: up.public_id }]);
        } catch { Alert.alert("Upload Failed"); }
        finally { setIsUploading(false); }
      }
    } catch {}
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={close} />
      <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handleWrap}><View style={styles.handle} /></View>
        <View style={styles.header}>
          <TouchableOpacity onPress={close} style={styles.cancelWrap}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Send Media</Text>
          <View style={{ width: 60 }} />
        </View>
        {isUploading ? (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="large" color="#0EA5E9" />
            <Text style={styles.uploadingText}>Uploading…</Text>
          </View>
        ) : (
          <View style={styles.actionsGrid}>
            <ActionBtn icon="camera" label="Camera" gradient={["#0EA5E9", "#0284C7"]} onPress={openCamera} />
            <ActionBtn icon="images" label="Gallery" gradient={["#0369A1", "#075985"]} onPress={openGalleryPicker} />
            <ActionBtn icon="videocam" label="Video" gradient={["#10B981", "#059669"]} onPress={openVideoPicker} />
            <ActionBtn icon="document-attach" label="File" gradient={["#F59E0B", "#D97706"]} onPress={openFilePicker} />
          </View>
        )}
      </Animated.View>
    </Modal>
  );
};

function ActionBtn({ icon, label, gradient, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  gradient: string[];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.82}>
      <LinearGradient colors={gradient as any} style={styles.actionIconGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Ionicons name={icon} size={28} color="#fff" />
      </LinearGradient>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default MediaPicker;

const styles = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 12 },
  handleWrap: { alignItems: "center", paddingTop: 10, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  cancelWrap: { width: 60 },
  cancelText: { fontSize: 15, color: "#64748B", fontWeight: "500" },
  title: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  actionsGrid: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },
  actionBtn: { alignItems: "center", gap: 8 },
  actionIconGradient: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  actionLabel: { fontSize: 12, fontWeight: "600", color: "#374151" },
  uploadingContainer: { alignItems: "center", paddingVertical: 32, gap: 12 },
  uploadingText: { fontSize: 14, color: "#64748B" },
});
