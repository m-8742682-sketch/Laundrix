// components/queue/MachineSelector.tsx
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

const { width, height } = Dimensions.get("window");

interface MachineSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  machines: string[];
  selectedMachineId: string;
  onSelectMachine: (machineId: string) => void;
  title?: string;
}

export function MachineSelectorModal({
  visible,
  onClose,
  machines,
  selectedMachineId,
  onSelectMachine,
  title = "Select Machine",
}: MachineSelectorModalProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 100,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleSelect = (machineId: string) => {
    onSelectMachine(machineId);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <BlurView intensity={20} style={styles.blur} tint="light" />
        
        <Pressable style={styles.backdrop} onPress={onClose}>
          <View style={styles.backdropInner} />
        </Pressable>

        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={["#FFFFFF", "#F8FAFC"]}
            style={styles.gradient}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <LinearGradient
                  colors={["#6366F1", "#8B5CF6"]}
                  style={styles.iconGradient}
                >
                  <Ionicons name="hardware-chip" size={24} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSubtitle}>
                {machines.length} machines available
              </Text>
            </View>

            {/* Machine List */}
            <View style={styles.listContainer}>
              {machines.map((machineId, index) => {
                const isSelected = machineId === selectedMachineId;
                const isFirst = index === 0;
                const isLast = index === machines.length - 1;

                return (
                  <TouchableOpacity
                    key={machineId}
                    style={[
                      styles.machineItem,
                      isSelected && styles.machineItemSelected,
                      isFirst && styles.machineItemFirst,
                      isLast && styles.machineItemLast,
                    ]}
                    onPress={() => handleSelect(machineId)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.machineItemContent}>
                      <View style={styles.machineIconContainer}>
                        <LinearGradient
                          colors={
                            isSelected
                              ? ["#6366F1", "#8B5CF6"]
                              : ["#F1F5F9", "#E2E8F0"]
                          }
                          style={styles.machineIconGradient}
                        >
                          <Ionicons
                            name="hardware-chip"
                            size={18}
                            color={isSelected ? "#fff" : "#64748B"}
                          />
                        </LinearGradient>
                      </View>

                      <View style={styles.machineInfo}>
                        <Text
                          style={[
                            styles.machineId,
                            isSelected && styles.machineIdSelected,
                          ]}
                        >
                          {machineId}
                        </Text>
                        <Text style={styles.machineStatus}>
                          {isSelected ? "Currently viewing" : "Tap to view queue"}
                        </Text>
                      </View>

                      {isSelected ? (
                        <View style={styles.selectedBadge}>
                          <LinearGradient
                            colors={["#10B981", "#059669"]}
                            style={styles.selectedBadgeGradient}
                          >
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color="#fff"
                            />
                            <Text style={styles.selectedBadgeText}>Active</Text>
                          </LinearGradient>
                        </View>
                      ) : (
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color="#CBD5E1"
                        />
                      )}
                    </View>

                    {isSelected && <View style={styles.selectedIndicator} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#F1F5F9", "#E2E8F0"]}
                style={styles.closeButtonGradient}
              >
                <Text style={styles.closeButtonText}>Cancel</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropInner: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  modalContainer: {
    marginHorizontal: 16,
    marginBottom: 34,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 20,
  },
  gradient: {
    padding: 20,
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  headerIcon: {
    marginBottom: 12,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  iconGradient: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "500",
  },

  // List
  listContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  machineItem: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  machineItemFirst: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  machineItemLast: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomWidth: 0,
  },
  machineItemSelected: {
    backgroundColor: "#EEF2FF",
  },
  machineItemContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  machineIconContainer: {
    marginRight: 14,
  },
  machineIconGradient: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  machineInfo: {
    flex: 1,
  },
  machineId: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  machineIdSelected: {
    color: "#4F46E5",
  },
  machineStatus: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },
  selectedBadge: {
    marginLeft: 8,
  },
  selectedBadgeGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  selectedBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  selectedIndicator: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    backgroundColor: "#6366F1",
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },

  // Close Button
  closeButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  closeButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#64748B",
  },
});