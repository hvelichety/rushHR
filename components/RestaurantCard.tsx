import { Restaurant } from "@/utils/types";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { formatTimeAgo } from "../utils/time";

/** Fallback when restaurant photo URLs fail to load */
const FALLBACK_RESTAURANT_IMAGE =
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&h=200&fit=crop";

type Props = {
  restaurant: Restaurant;
  minutesSinceUpdate: number;
  secondsSinceCall: number;
  cooldownSeconds: number;
  canRequest: boolean;
  isLoading?: boolean;
  onRequest: () => void;
};

export default function RestaurantCard({
  restaurant,
  minutesSinceUpdate,
  secondsSinceCall: _secondsSinceCall,
  cooldownSeconds: _cooldownSeconds,
  canRequest: _canRequest,
  isLoading = false,
  onRequest,
}: Props) {
  const { name, cuisine, waitMinutes, image, distance_miles, city, state } = restaurant;
  const [imageUri, setImageUri] = useState(image?.trim() || FALLBACK_RESTAURANT_IMAGE);

  useEffect(() => {
    setImageUri(image?.trim() || FALLBACK_RESTAURANT_IMAGE);
  }, [image, restaurant.id]);

  // Don't show generic/useless cuisine labels from the backend
  const GENERIC_CUISINES = new Set(["restaurant", "food", "establishment", "point_of_interest", "unknown"]);
  const displayCuisine = cuisine && !GENERIC_CUISINES.has(cuisine.toLowerCase()) ? cuisine : null;

  // COOLDOWN DISABLED (today) — button always available unless closed or loading
  // const isAvailable = canRequest;
  // const remainingSecs = Math.max(0, cooldownSeconds - secondsSinceCall);
  // let disabledReason = "";
  // if (!isLoading && !isAvailable) {
  //   const minsRemaining = Math.max(1, Math.ceil(remainingSecs / 60));
  //   disabledReason = `Available in ${minsRemaining} min`;
  // }
  const isAvailable = true;

  const accessibilityLabel = `${name}${displayCuisine ? `, ${displayCuisine}` : ""}, ${waitMinutes > 0 ? `${waitMinutes} minute wait` : "no wait"}, updated ${formatTimeAgo(minutesSinceUpdate)}`;

  const buttonAccessibilityLabel = `Request wait time for ${name}`;

  return (
    <View
      style={styles.card}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
    >
      <Image
        source={{ uri: imageUri }}
        style={styles.thumb}
        contentFit="cover"
        transition={200}
        onError={() => setImageUri(FALLBACK_RESTAURANT_IMAGE)}
        accessible={true}
        accessibilityLabel={`${name} restaurant photo`}
      />

      <View style={styles.infoCol}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {distance_miles !== undefined && distance_miles !== null && distance_miles < 1 && (
            <View style={styles.nearbyBadge}>
              <Text style={styles.nearbyText}>Nearby</Text>
            </View>
          )}
        </View>

        <View style={styles.locationRow}>
          {displayCuisine && (
            <Text style={styles.cuisine} numberOfLines={1}>
              {displayCuisine}
            </Text>
          )}
          {city && state && (
            <Text style={styles.cityState} numberOfLines={1}>
              {displayCuisine ? " • " : ""}{city}, {state}
            </Text>
          )}
          {distance_miles !== undefined && distance_miles !== null && (
            <Text style={styles.distance} numberOfLines={1}>
              {" • "}{distance_miles.toFixed(1)} mi
            </Text>
          )}
        </View>

        <View style={styles.waitRow}>
          <Text style={styles.wait} numberOfLines={1}>
            {waitMinutes > 0 ? `${waitMinutes} min wait` : "No wait"}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {" • "} {formatTimeAgo(minutesSinceUpdate)}
          </Text>
        </View>

        <Pressable
          onPress={onRequest}
          disabled={isLoading}
          accessible={true}
          accessibilityLabel={buttonAccessibilityLabel}
          accessibilityRole="button"
          accessibilityState={{
            disabled: isLoading,
            busy: isLoading,
          }}
          style={({ pressed }) => [
            styles.button,
            isLoading && styles.buttonDisabled,
            pressed && !isLoading && styles.buttonPressed,
          ]}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={[styles.buttonText, { marginLeft: 8 }]}>
                Calling...
              </Text>
            </View>
          ) : (
            <Text style={styles.buttonText} numberOfLines={1}>
              Request Wait Time
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  thumb: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
  },
  infoCol: {
    flex: 1,
    justifyContent: "space-between",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    flexShrink: 1,
  },
  nearbyBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  nearbyText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    minWidth: 0,
  },
  cuisine: {
    color: "#64748B",
    fontSize: 14,
    flexShrink: 0,
  },
  distance: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  cityState: {
    color: "#64748B",
    fontSize: 14,
    flexShrink: 1,
  },
  waitRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    minWidth: 0,
    marginVertical: 6,
  },
  wait: {
    fontWeight: "600",
    color: "#0F172A",
    fontSize: 15,
    flexShrink: 0,
  },
  meta: {
    color: "#64748B",
    fontSize: 14,
    flexShrink: 1,
  },
  button: {
    backgroundColor: "#F45B5B",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    backgroundColor: "#E2E8F0",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  buttonTextDisabled: {
    color: "#94A3B8",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});