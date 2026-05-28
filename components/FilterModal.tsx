import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

const { height } = Dimensions.get("window");

interface Props {
  visible: boolean;
  onClose: () => void;
  selectedCuisine: string;
  showNearbyOnly: boolean;
  availableCuisines: string[];
  hasLocation: boolean;
  onApply: (cuisine: string, nearbyOnly: boolean) => void;
}

export default function FilterModal({
  visible,
  onClose,
  selectedCuisine,
  showNearbyOnly,
  availableCuisines,
  hasLocation,
  onApply,
}: Props) {
  const slideAnim = useRef(new Animated.Value(height)).current;

  // Draft state — only committed when user taps Apply
  const [tempCuisine, setTempCuisine] = useState(selectedCuisine);
  const [tempNearby, setTempNearby] = useState(showNearbyOnly);

  // Sync drafts when modal opens
  useEffect(() => {
    if (visible) {
      setTempCuisine(selectedCuisine);
      setTempNearby(showNearbyOnly);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleApply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onApply(tempCuisine, tempNearby);
  };

  const handleClearAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTempCuisine("All");
    setTempNearby(false);
    onApply("All", false);
  };

  const pendingCount =
    (tempCuisine !== "All" ? 1 : 0) + (tempNearby ? 1 : 0);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, height],
                    outputRange: [0, height],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Filters</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Distance section */}
          {hasLocation && (
            <>
              <Text style={styles.sectionLabel}>Distance</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={styles.radioRow}
                  onPress={() => {
                    setTempNearby(false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radio, !tempNearby && styles.radioSelected]}>
                    {!tempNearby && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.radioLabel}>Show All</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.radioRow}
                  onPress={() => {
                    setTempNearby(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radio, tempNearby && styles.radioSelected]}>
                    {tempNearby && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.radioLabel}>Nearby Only</Text>
                  <Text style={styles.radioHint}> (within 30 mi)</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Cuisine section */}
          <Text style={styles.sectionLabel}>Cuisine</Text>
          <View style={styles.chipWrap}>
            {availableCuisines.map((cuisine) => {
              const active = tempCuisine === cuisine;
              return (
                <TouchableOpacity
                  key={cuisine}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => {
                    setTempCuisine(cuisine);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {cuisine}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.clearButton} onPress={handleClearAll} activeOpacity={0.7}>
              <Text style={styles.clearText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply} activeOpacity={0.8}>
              <Text style={styles.applyText}>
                {pendingCount > 0 ? `Apply (${pendingCount})` : "Apply"}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  handle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "700",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  radioGroup: {
    gap: 12,
    marginBottom: 24,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: "#F45B5B",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F45B5B",
  },
  radioLabel: {
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "500",
  },
  radioHint: {
    fontSize: 14,
    color: "#94A3B8",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 32,
  },
  chip: {
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  chipActive: {
    backgroundColor: "#F45B5B",
    borderColor: "#F45B5B",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
  },
  clearButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  clearText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#64748B",
  },
  applyButton: {
    flex: 2,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: "#F45B5B",
    alignItems: "center",
  },
  applyText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
