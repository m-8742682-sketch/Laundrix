/**
 * MediaPicker — WhatsApp / Telegram-style bottom-sheet media grid
 *
 * Design goals (matching user expectation):
 *  - Slides up from bottom as a bottom sheet, NOT a full-screen modal
 *  - Top row: Camera / Gallery / Video / File action buttons
 *  - Below: live thumbnail grid of recent photos from camera roll
 *  - Tap thumbnail to select/deselect (numbered badge + indigo border)
 *  - "Send" button in header once ≥1 selected
 *  - Dark handle, clean white card — matches WhatsApp UX
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as DocumentPicker from "expo-document-picker";
import { uploadMedia } from "@/services/mediaUpload.service";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

const GRID_COLS = 3;
const THUMB_GAP = 2;
const THUMB_SIZE = (width - THUMB_GAP * (GRID_COLS + 1)) / GRID_COLS;
const SHEET_HEIGHT = height * 0.72;

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

const MediaPicker: React.FC<MediaPickerProps> = ({
  visible,
  onClose,
  onSelect,
  maxSelection = 10,
}) => {
  const insets = useSafeAreaInsets();
  const [galleryAssets, setGalleryAssets] = useState<MediaLibrary.Asset[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);

  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  useEffect(() => {
    if (!visible) {
      setSelectedIds(new Set());
      return;
    }
    Animated.spring(slideAnim, {
      toValue: 0, tension: 70, friction: 13, useNativeDriver: true,
    }).start();
    loadGallery();
  }, [visible]);

  const close = () => {
    Animated.timing(slideAnim, { toValue: SHEET_HEIGHT, duration: 240, useNativeDriver: true }).start(onClose);
  };

  const loadGallery = async () => {
    setIsLoadingGallery(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      setHasPermission(perm.granted);
      if (!perm.granted) return;
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        first: 60,
        sortBy: MediaLibrary.SortBy.creationTime,
      });
      setGalleryAssets(result.assets);
    } catch {}
    finally { setIsLoadingGallery(false); }
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= maxSelection) {
          Alert.alert("Limit Reached", `Max ${maxSelection} items.`);
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }, [maxSelection]);

  const sendSelected = async () => {
    const selected = galleryAssets.filter(a => selectedIds.has(a.id));
    if (!selected.length) return;
    setIsUploading(true);
    try {
      const assets: MediaAsset[] = await Promise.all(
        selected.map(async (a) => {
          const info = await MediaLibrary.getAssetInfoAsync(a);
          const uri = info.localUri || a.uri;
          const isVideo = a.mediaType === MediaLibrary.MediaType.video;
          const up = await uploadMedia(uri, isVideo ? "video" : "image");
          return {
            uri, type: isVideo ? "video" : "image",
            name: a.filename || `media_${Date.now()}`,
            duration: a.duration || null,
            width: a.width, height: a.height,
            cloudinaryUrl: up.secure_url, publicId: up.public_id,
          } as MediaAsset;
        })
      );
      onSelect(assets);
      close();
    } catch { Alert.alert("Upload Failed", "Please try again."); }
    finally { setIsUploading(false); }
  };

  const openCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission Required", "Camera access needed."); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!r.canceled && r.assets[0]) {
      const a = r.assets[0];
      setIsUploading(true);
      try {
        const up = await uploadMedia(a.uri, "image");
        onSelect([{ uri: a.uri, type: "image", name: a.uri.split("/").pop() || "photo.jpg", width: a.width, height: a.height, cloudinaryUrl: up.secure_url, publicId: up.public_id }]);
        close();
      } catch { Alert.alert("Upload Failed"); }
      finally { setIsUploading(false); }
    }
  };

  const openGalleryPicker = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: maxSelection, quality: 0.85 });
    if (!r.canceled && r.assets.length) {
      setIsUploading(true);
      try {
        const uploaded = await Promise.all(r.assets.map(async a => {
          const up = await uploadMedia(a.uri, "image");
          return { uri: a.uri, type: "image" as MediaType, name: a.uri.split("/").pop() || "image.jpg", width: a.width, height: a.height, cloudinaryUrl: up.secure_url, publicId: up.public_id };
        }));
        onSelect(uploaded);
        close();
      } catch { Alert.alert("Upload Failed"); }
      finally { setIsUploading(false); }
    }
  };

  const openVideoPicker = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 0.85 });
    if (!r.canceled && r.assets[0]) {
      const a = r.assets[0];
      setIsUploading(true);
      try {
        const up = await uploadMedia(a.uri, "video");
        onSelect([{ uri: a.uri, type: "video", name: a.uri.split("/").pop() || "video.mp4", duration: a.duration, cloudinaryUrl: up.secure_url, publicId: up.public_id }]);
        close();
      } catch { Alert.alert("Upload Failed"); }
      finally { setIsUploading(false); }
    }
  };

  const openFilePicker = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (!r.canceled && r.assets[0]) {
        const f = r.assets[0];
        setIsUploading(true);
        try {
          const up = await uploadMedia(f.uri, "file");
          onSelect([{ uri: f.uri, type: "file", name: f.name, size: f.size, mimeType: f.mimeType || "application/octet-stream", cloudinaryUrl: up.secure_url, publicId: up.public_id }]);
          close();
        } catch { Alert.alert("Upload Failed"); }
        finally { setIsUploading(false); }
      }
    } catch {}
  };

  const renderThumb = useCallback(({ item, index }: { item: MediaLibrary.Asset; index: number }) => {
    const selected = selectedIds.has(item.id);
    const selIdx = selected ? [...selectedIds].indexOf(item.id) + 1 : -1;
    const isVideo = item.mediaType === MediaLibrary.MediaType.video;
    return (
      <TouchableOpacity
        onPress={() => toggleSelect(item.id)}
        activeOpacity={0.8}
        style={[styles.thumb, selected && styles.thumbSelected, { marginLeft: index % GRID_COLS === 0 ? THUMB_GAP : 0 }]}
      >
        <Image source={{ uri: item.uri }} style={styles.thumbImg} resizeMode="cover" />
        {isVideo && (
          <View style={styles.videoBadge}>
            <Ionicons name="play" size={8} color="#fff" />
            <Text style={styles.videoDur}>{fmtDur(item.duration || 0)}</Text>
          </View>
        )}
        {selected ? (
          <View style={styles.selOverlay}>
            <View style={styles.checkBadge}><Text style={styles.checkNum}>{selIdx}</Text></View>
          </View>
        ) : (
          <View style={styles.unselCircle} />
        )}
      </TouchableOpacity>
    );
  }, [selectedIds, toggleSelect]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={close} />
      <Animated.View style={[styles.sheet, { paddingBottom: insets.bottom + 8, transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={styles.handleWrap}><View style={styles.handle} /></View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={close} style={styles.cancelWrap}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{selectedIds.size > 0 ? `${selectedIds.size} selected` : "Media"}</Text>
          {selectedIds.size > 0 ? (
            <TouchableOpacity onPress={sendSelected} style={styles.sendBtn} disabled={isUploading}>
              {isUploading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendText}>Send</Text>}
            </TouchableOpacity>
          ) : <View style={{ width: 60 }} />}
        </View>

        {/* Quick actions */}
        <View style={styles.actions}>
          <ActionBtn icon="camera" label="Camera" color="#0EA5E9" onPress={openCamera} />
          <ActionBtn icon="images" label="Gallery" color="#0EA5E9" onPress={openGalleryPicker} />
          <ActionBtn icon="videocam" label="Video" color="#10B981" onPress={openVideoPicker} />
          <ActionBtn icon="document-attach" label="File" color="#F59E0B" onPress={openFilePicker} />
        </View>

        <View style={styles.divider} />

        {/* Grid */}
        {isUploading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /><Text style={styles.uploadTxt}>Uploading…</Text></View>
        ) : !hasPermission ? (
          <View style={styles.center}>
            <Ionicons name="images-outline" size={44} color="#CBD5E1" />
            <Text style={styles.permTxt}>Allow access to your photos</Text>
            <TouchableOpacity style={styles.permBtn} onPress={loadGallery}><Text style={styles.permBtnTxt}>Allow Access</Text></TouchableOpacity>
          </View>
        ) : isLoadingGallery ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#0EA5E9" /></View>
        ) : (
          <FlatList
            data={galleryAssets}
            keyExtractor={i => i.id}
            numColumns={GRID_COLS}
            renderItem={renderThumb}
            columnWrapperStyle={styles.row}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
            ListEmptyComponent={<View style={styles.center}><Text style={styles.permTxt}>No recent photos</Text></View>}
          />
        )}
      </Animated.View>
    </Modal>
  );
};

function ActionBtn({ icon, label, color, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.78}>
      <View style={[styles.actionIcon, { backgroundColor: `${color}15`, borderColor: `${color}28` }]}>
        <Ionicons name={icon} size={26} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function fmtDur(s: number) {
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: SHEET_HEIGHT,
    backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22,
    overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 18,
  },
  handleWrap: { alignItems: "center", paddingTop: 10, paddingBottom: 2 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#CBD5E1" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  cancelWrap: { width: 60 },
  cancelText: { fontSize: 15, color: "#64748B", fontWeight: "500" },
  title: { fontSize: 16, fontWeight: "700", color: "#0F172A", letterSpacing: -0.2 },
  sendBtn: { width: 60, backgroundColor: "#0EA5E9", borderRadius: 20, paddingVertical: 6, alignItems: "center" },
  sendText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  actions: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 12, paddingVertical: 14 },
  actionBtn: { alignItems: "center", gap: 7 },
  actionIcon: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  actionLabel: { fontSize: 11, fontWeight: "600", color: "#64748B" },
  divider: { height: 1, backgroundColor: "#F1F5F9", marginBottom: 2 },
  row: { marginBottom: THUMB_GAP, paddingRight: THUMB_GAP },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, marginRight: THUMB_GAP, borderRadius: 2, overflow: "hidden" },
  thumbSelected: { borderWidth: 2.5, borderColor: "#0EA5E9", borderRadius: 4 },
  thumbImg: { width: "100%", height: "100%" },
  selOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(99,102,241,0.2)", alignItems: "flex-end", padding: 4 },
  checkBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#0EA5E9", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#fff" },
  checkNum: { color: "#fff", fontSize: 10, fontWeight: "800" },
  unselCircle: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "rgba(255,255,255,0.85)", backgroundColor: "rgba(0,0,0,0.1)" },
  videoBadge: { position: "absolute", bottom: 4, left: 4, flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "rgba(0,0,0,0.56)", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8 },
  videoDur: { color: "#fff", fontSize: 9, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 60 },
  uploadTxt: { color: "#64748B", fontSize: 14, fontWeight: "500" },
  permTxt: { color: "#94A3B8", fontSize: 14, textAlign: "center" },
  permBtn: { backgroundColor: "#0EA5E9", borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, marginTop: 4 },
  permBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

export default MediaPicker;
