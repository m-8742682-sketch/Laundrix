// components/contact/MediaPicker.tsx
import React, { useState, useCallback } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { LinearGradient } from "expo-linear-gradient";
import { uploadMedia, CloudinaryUploadResult } from "@/services/mediaUpload.service";

const { width } = Dimensions.get("window");

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
  const [selectedAssets, setSelectedAssets] = useState<MediaAsset[]>([]);
  const [activeTab, setActiveTab] = useState<"gallery" | "file">("gallery");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please grant permission to access your media library."
      );
      return false;
    }
    return true;
  };

  const pickImages = useCallback(async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: maxSelection,
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets) {
        const assets: MediaAsset[] = result.assets.map((asset) => ({
          uri: asset.uri,
          type: "image",
          name: asset.uri.split("/").pop() || `image_${Date.now()}.jpg`,
          width: asset.width,
          height: asset.height,
          mimeType: asset.mimeType || "image/jpeg",
        }));
        setSelectedAssets(assets);
      }
    } catch (error) {
      console.error("Error picking images:", error);
      Alert.alert("Error", "Failed to pick images");
    }
  }, [maxSelection]);

  const pickVideos = useCallback(async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: true,
        selectionLimit: maxSelection,
      });

      if (!result.canceled && result.assets) {
        const assets: MediaAsset[] = result.assets.map((asset) => ({
          uri: asset.uri,
          type: "video",
          name: asset.uri.split("/").pop() || `video_${Date.now()}.mp4`,
          duration: asset.duration,
          width: asset.width,
          height: asset.height,
          mimeType: asset.mimeType || "video/mp4",
        }));
        setSelectedAssets(assets);
      }
    } catch (error) {
      console.error("Error picking videos:", error);
      Alert.alert("Error", "Failed to pick videos");
    }
  }, [maxSelection]);

  const pickFiles = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        const assets: MediaAsset[] = result.assets.map((asset) => ({
          uri: asset.uri,
          type: "file",
          name: asset.name,
          size: asset.size,
          mimeType: asset.mimeType || "application/octet-stream",
        }));
        setSelectedAssets(assets);
      }
    } catch (error) {
      console.error("Error picking files:", error);
      Alert.alert("Error", "Failed to pick files");
    }
  }, []);

  const handleConfirm = async () => {
    if (selectedAssets.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const uploadedAssets: MediaAsset[] = await Promise.all(
        selectedAssets.map(async (asset, index) => {
          const result = await uploadMedia(asset.uri, asset.type, 'chat_uploads');
          
          setUploadProgress(((index + 1) / selectedAssets.length) * 100);
          
          return {
            ...asset,
            cloudinaryUrl: result.secure_url,
            publicId: result.public_id,
            uri: result.secure_url,
            width: result.width || asset.width,
            height: result.height || asset.height,
            duration: result.duration || asset.duration,
          };
        })
      );
      
      onSelect(uploadedAssets);
      setSelectedAssets([]);
      onClose();
    } catch (error) {
      Alert.alert(
        "Upload Failed", 
        "Some files failed to upload. Please try again."
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const removeAsset = (index: number) => {
    setSelectedAssets((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderAsset = ({ item, index }: { item: MediaAsset; index: number }) => (
    <View style={styles.assetItem}>
      {item.type === "image" ? (
        <Image source={{ uri: item.uri }} style={styles.assetThumbnail} />
      ) : item.type === "video" ? (
        <View style={[styles.assetThumbnail, styles.videoThumbnail]}>
          <Ionicons name="videocam" size={24} color="#fff" />
          {item.duration && (
            <Text style={styles.videoDuration}>
              {Math.floor(item.duration / 60)}:
              {String(Math.floor(item.duration % 60)).padStart(2, "0")}
            </Text>
          )}
        </View>
      ) : (
        <View style={[styles.assetThumbnail, styles.fileThumbnail]}>
          <Ionicons name="document" size={24} color="#6366F1" />
        </View>
      )}
      
      <View style={styles.assetInfo}>
        <Text style={styles.assetName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.assetMeta}>
          {item.type === "file" ? formatFileSize(item.size) : item.type}
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => removeAsset(index)}
        style={styles.removeButton}
        disabled={isUploading}
      >
        <Ionicons name="close-circle" size={24} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={!isUploading ? onClose : undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeButton}
              disabled={isUploading}
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Share Media</Text>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={selectedAssets.length === 0 || isUploading}
              style={[
                styles.sendButton,
                (selectedAssets.length === 0 || isUploading) && styles.sendButtonDisabled,
              ]}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text
                  style={[
                    styles.sendButtonText,
                    selectedAssets.length === 0 && styles.sendButtonTextDisabled,
                  ]}
                >
                  Send ({selectedAssets.length})
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Upload Progress */}
          {isUploading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${uploadProgress}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                Uploading... {Math.round(uploadProgress)}%
              </Text>
            </View>
          )}

          {/* Tabs */}
          {!isUploading && (
            <>
              <View style={styles.tabContainer}>
                <TouchableOpacity
                  onPress={() => setActiveTab("gallery")}
                  style={[styles.tab, activeTab === "gallery" && styles.tabActive]}
                >
                  <Ionicons
                    name="images"
                    size={20}
                    color={activeTab === "gallery" ? "#6366F1" : "#94A3B8"}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === "gallery" && styles.tabTextActive,
                    ]}
                  >
                    Gallery
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setActiveTab("file")}
                  style={[styles.tab, activeTab === "file" && styles.tabActive]}
                >
                  <Ionicons
                    name="document"
                    size={20}
                    color={activeTab === "file" ? "#6366F1" : "#94A3B8"}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === "file" && styles.tabTextActive,
                    ]}
                  >
                    Files
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                {activeTab === "gallery" ? (
                  <>
                    <TouchableOpacity
                      onPress={pickImages}
                      style={styles.actionButton}
                    >
                      <LinearGradient
                        colors={["#6366F1", "#8B5CF6"]}
                        style={styles.actionGradient}
                      >
                        <Ionicons name="image" size={28} color="#fff" />
                        <Text style={styles.actionText}>Photos</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={pickVideos}
                      style={styles.actionButton}
                    >
                      <LinearGradient
                        colors={["#EC4899", "#F43F5E"]}
                        style={styles.actionGradient}
                      >
                        <Ionicons name="videocam" size={28} color="#fff" />
                        <Text style={styles.actionText}>Videos</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity onPress={pickFiles} style={styles.actionButton}>
                    <LinearGradient
                      colors={["#10B981", "#059669"]}
                      style={styles.actionGradient}
                    >
                      <Ionicons name="folder" size={28} color="#fff" />
                      <Text style={styles.actionText}>Browse Files</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>

              {/* Selected Assets List */}
              {selectedAssets.length > 0 && (
                <View style={styles.selectedContainer}>
                  <Text style={styles.selectedTitle}>
                    Selected ({selectedAssets.length})
                  </Text>
                  <FlatList
                    data={selectedAssets}
                    renderItem={renderAsset}
                    keyExtractor={(item, index) => `${item.uri}-${index}`}
                    showsVerticalScrollIndicator={false}
                    style={styles.selectedList}
                  />
                </View>
              )}

              {/* Empty State */}
              {selectedAssets.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="cloud-upload" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyText}>
                    Select {activeTab === "gallery" ? "photos or videos" : "files"} to share
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingBottom: 34,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#0F172A",
  },
  sendButton: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: "#E2E8F0",
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  sendButtonTextDisabled: {
    color: "#94A3B8",
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  tabActive: {
    backgroundColor: "#EEF2FF",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#94A3B8",
  },
  tabTextActive: {
    color: "#6366F1",
  },
  actionsContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  actionGradient: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 8,
  },
  actionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  selectedContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  selectedTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 12,
  },
  selectedList: {
    maxHeight: 300,
  },
  assetItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  assetThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  videoThumbnail: {
    backgroundColor: "#1e293b",
  },
  videoDuration: {
    position: "absolute",
    bottom: 4,
    right: 4,
    fontSize: 10,
    color: "#fff",
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fileThumbnail: {
    backgroundColor: "#EEF2FF",
  },
  assetInfo: {
    flex: 1,
    marginLeft: 12,
  },
  assetName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0F172A",
  },
  assetMeta: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  removeButton: {
    padding: 4,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 12,
  },
});

export default MediaPicker;