import React, { useEffect } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Restaurant } from "../utils/types";

const { height } = Dimensions.get("window");

interface Props {
  visible: boolean;
  onClose: () => void;
  requested: Restaurant | null;
  recommendations: Restaurant[];
  onRecommendationTap?: (restaurant: Restaurant) => void;
}

export default function RequestModal({
  visible,
  onClose,
  requested,
  recommendations,
  onRecommendationTap,
}: Props) {
  const slideAnim = new Animated.Value(height);

  useEffect(() => {
    if (visible) {
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

  if (!requested) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={styles.overlay}>
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
          <Text style={styles.title}>⏳ Request Received</Text>
          <Text style={styles.subtitle}>
            We'll notify you when the wait time is ready for{" "}
            <Text style={{ fontWeight: "700" }}>{requested.name}</Text>!
            Usually takes{" "}
            <Text style={{ fontWeight: "600" }}>1-2 minutes.</Text>
          </Text>

          <Text style={[styles.subtitle, { marginTop: 12 }]}>
            Meanwhile, check out these similar spots 🍴
          </Text>

          <FlatList
            data={recommendations}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => {
                  if (onRecommendationTap) {
                    onClose();
                    onRecommendationTap(item);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  {item.distance_miles !== undefined && item.distance_miles !== null && (
                    <Text style={styles.cardDistance}>
                      {item.distance_miles.toFixed(1)} mi
                    </Text>
                  )}
                </View>
                <View style={styles.cardDetails}>
                  <Text style={styles.cardSubtitle}>
                    {item.cuisine || "Restaurant"}
                  </Text>
                  <Text style={styles.cardWait}>
                    {" • "}
                    {item.waitMinutes > 0 ? `${item.waitMinutes} min wait` : "No wait"}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                No similar restaurants nearby.
              </Text>
            }
            contentContainerStyle={{ marginTop: 10 }}
          />

          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Got it</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  handle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    backgroundColor: "#E2E8F0",
    borderRadius: 3,
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: "#475569",
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontWeight: "700",
    fontSize: 16,
    color: "#0F172A",
    flex: 1,
  },
  cardDistance: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10B981",
  },
  cardDetails: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#64748B",
  },
  cardWait: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 8,
  },
  button: {
    backgroundColor: "#F45B5B",
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 16,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
    fontSize: 16,
  },
});
