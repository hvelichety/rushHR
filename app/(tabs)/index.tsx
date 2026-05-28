import { EventSourcePolyfill } from "event-source-polyfill";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import FilterModal from "../../components/FilterModal";
import RequestModal from "../../components/RequestModal";
import RestaurantCard from "../../components/RestaurantCard";
import { fetchRestaurant, requestWaitTime } from "../../utils/api";
import { API_BASE_URL } from "../../utils/config";
import { minutesSince } from "../../utils/time";
import { Restaurant } from "../../utils/types";
const EventSource = EventSourcePolyfill;

import {
  getCurrentLocation,
  requestLocationPermission,
  UserLocation,
} from "../../utils/location";

import {
  getDeviceId,
  registerForPushNotifications,
  registerPushToken,
  setupNotificationListeners,
} from "../../utils/notifications";



export default function HomeScreen() {
  const [query, setQuery] = useState("");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingRestaurantId, setLoadingRestaurantId] = useState<number | null>(null);
  const [selectedCuisine, setSelectedCuisine] = useState<string>("All");

  // Location state
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationReady, setLocationReady] = useState(false);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [showNearbyOnly, setShowNearbyOnly] = useState(false);

  // filter modal state
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [requested, setRequested] = useState<Restaurant | null>(null);
  const [recommendations, setRecommendations] = useState<Restaurant[]>([]);

  // const [now, setNow] = useState(Date.now()); // COOLDOWN DISABLED (today)
  const deviceIdRef = useRef<string | null>(null);
  const pushTokenRef = useRef<string | null>(null);
  // Cooldown disabled: every tap triggers a call request

  // Push notifications
  useEffect(() => {
    async function setupPushNotifications() {
      const id = await getDeviceId();
      deviceIdRef.current = id;
      const token = await registerForPushNotifications();
      if (token) {
        pushTokenRef.current = token;
        await registerPushToken(id, token);
        console.log('🔔 Push notifications registered');
      }
    }

    setupPushNotifications();

    const cleanup = setupNotificationListeners((data) => {
      console.log('👆 Notification tapped:', data);
    });

    return cleanup;
  }, []);

  // Setup location tracking
  useEffect(() => {
    async function setupLocation() {
      console.log("📍 Requesting location permission...");
      const hasPermission = await requestLocationPermission();

      if (hasPermission) {
        const location = await getCurrentLocation();
        if (location) {
          console.log("✅ Location obtained:", location);
          setUserLocation(location);
          // Don't default to nearby - let user choose
          setShowNearbyOnly(false);
        }
      } else {
        console.warn("⚠️ Location permission denied");
        setLocationPermissionDenied(true);
      }

      // Signal that the location attempt is done (success or denied)
      // so the restaurant fetch knows it has the best available location.
      setLocationReady(true);
    }

    setupLocation();

    // Update location every 5 minutes
    const interval = setInterval(async () => {
      const location = await getCurrentLocation();
      if (location) {
        console.log("🔄 Location updated:", location);
        setUserLocation(location);
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Refresh restaurant list periodically (every 5 minutes)
  useEffect(() => {
    const interval = setInterval(async () => {
      console.log("🔁 Refreshing restaurant data...");
      try {
        let url = `${API_BASE_URL}/restaurants`;
        if (userLocation) {
          url += `?lat=${userLocation.latitude}&lng=${userLocation.longitude}`;
          if (showNearbyOnly) url += `&radius=50`;
        }

        const res = await fetch(url);
        if (!res.ok) {
          console.error("❌ Periodic refresh failed:", res.status);
          return;
        }

        const raw = await res.json();

        // Handle response format (check for .data property)
        const restaurantArray = Array.isArray(raw) ? raw : (raw.data || []);

        const apiData: Restaurant[] = restaurantArray.map((r: any) => ({
          id: r.id,
          name: r.name,
          cuisine: r.cuisine || "Unknown",
          phone: r.phone,
          waitMinutes: r.wait_minutes,
          lastUpdatedAt: r.last_updated_at < 1e12 ? r.last_updated_at * 1000 : r.last_updated_at,
          image: r.image || 'https://via.placeholder.com/150',
          timezone: r.timezone,
          openHour: r.open_hour,
          closeHour: r.close_hour,
          lastCalledAt: r.last_called_at,
          // Location fields
          latitude: r.latitude,
          longitude: r.longitude,
          address: r.address,
          city: r.city,
          state: r.state,
          rating: r.rating,
          distance_miles: r.distance_miles,
        }));

        setRestaurants(prev =>
          apiData.map(apiR => {
            const existing = prev.find(x => x.id === apiR.id);
            if (!existing) return apiR;

            // Preserve local lastCalledAt if it's more recent than backend
            let lastCalledAt = existing.lastCalledAt;
            if (apiR.lastCalledAt) {
              const existingTime = existing.lastCalledAt ? new Date(existing.lastCalledAt).getTime() : 0;
              const apiTime = new Date(apiR.lastCalledAt).getTime();
              lastCalledAt = apiTime > existingTime ? apiR.lastCalledAt : existing.lastCalledAt;
            }

            return {
              ...existing,
              waitMinutes: apiR.waitMinutes ?? existing.waitMinutes,
              openHour: apiR.openHour,
              closeHour: apiR.closeHour,
              lastCalledAt,
              lastUpdatedAt: existing.lastUpdatedAt,
            };
          })
        );
      } catch (err) {
        console.error("Failed to refresh restaurants:", err);
      }
    }, 5 * 60 * 1000); // every 5 minutes

    return () => clearInterval(interval);
  }, [userLocation, showNearbyOnly]); // Re-subscribe when location or filter changes

  

  // Fetch initial restaurant data — waits for location attempt to settle first
  useEffect(() => {
    if (!locationReady) return;

    async function fetchInitialData() {
      try {
        setLoading(true);

        // Always pass lat/lng when available so backend computes distance_miles.
        // radius param only applied when showNearbyOnly is active.
        let url = `${API_BASE_URL}/restaurants`;
        if (userLocation) {
          url += `?lat=${userLocation.latitude}&lng=${userLocation.longitude}`;
          if (showNearbyOnly) url += `&radius=50`;
          console.log("📡 Fetching with location:", url);
        } else {
          console.log("📡 Fetching all restaurants (no location):", url);
        }

        const res = await fetch(url);

        if (!res.ok) {
          const text = await res.text();
          console.error("❌ Fetch failed:", res.status, res.statusText, text);
          Toast.show({
            type: 'error',
            text1: 'Failed to load restaurants',
            text2: 'Please check your connection',
          });
          return;
        }

        const raw = await res.json();
        console.log("📦 Raw response:", JSON.stringify(raw).substring(0, 200));
        console.log("📦 Response type:", typeof raw, Array.isArray(raw) ? "IS ARRAY" : "NOT ARRAY");

        // Handle different response formats
        let restaurantArray;
        if (Array.isArray(raw)) {
          restaurantArray = raw;
        } else if (raw && typeof raw === 'object' && Array.isArray(raw.data)) {
          console.log("📦 Found 'data' array inside object (common backend pattern)");
          restaurantArray = raw.data;
        } else if (raw && typeof raw === 'object' && Array.isArray(raw.restaurants)) {
          console.log("📦 Found 'restaurants' array inside object");
          restaurantArray = raw.restaurants;
        } else {
          console.error("❌ Response format not recognized:", raw);
          console.error("❌ Keys in response:", Object.keys(raw || {}));
          return;
        }

        console.log("✅ Fetched restaurants:", restaurantArray.length, "items");

        const data: Restaurant[] = restaurantArray.map((r: any) => ({
          id: r.id,
          name: r.name,
          cuisine: r.cuisine || "Unknown",
          phone: r.phone,
          waitMinutes: r.wait_minutes,
          lastUpdatedAt: r.last_updated_at < 1e12 ? r.last_updated_at * 1000 : r.last_updated_at,
          image: r.image || 'https://via.placeholder.com/150',
          timezone: r.timezone,
          openHour: r.open_hour,
          closeHour: r.close_hour,
          lastCalledAt: r.last_called_at,
          // Location fields
          latitude: r.latitude,
          longitude: r.longitude,
          address: r.address,
          city: r.city,
          state: r.state,
          rating: r.rating,
          distance_miles: r.distance_miles,
        }));

        console.log("✅ Mapped data:", data.length, "items");
        console.log("✅ Setting restaurants state with", data.length, "items");
        setRestaurants(data);
        console.log("✅ State set complete");
      } catch (err) {
        console.error("❌ Failed to fetch restaurants:", err);
        Toast.show({
          type: 'error',
          text1: 'Error loading restaurants',
          text2: 'Please try again',
        });
      } finally {
        setLoading(false);
        setDataLoaded(true);
      }
    }

    fetchInitialData();
  }, [locationReady, showNearbyOnly]); // Wait for location to settle, then re-fetch if nearby filter changes

const esRef = useRef<InstanceType<typeof EventSourcePolyfill> | null>(null);
const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  if (!dataLoaded) return;

  function connect() {
    console.log("📡 Connecting to live stream...");
    const es = new EventSourcePolyfill(`${API_BASE_URL}/stream`);
    esRef.current = es;

    es.addEventListener("message", (event: MessageEvent) => {
      try {
        const raw = JSON.parse(event.data);
        const updatedData = Array.isArray(raw) ? raw : (raw.data || null);

        if (!Array.isArray(updatedData)) {
          console.log("🫀 Heartbeat received — no update");
          return;
        }

        setRestaurants((prev) =>
          prev.map((r) => {
            const latest = updatedData.find((u: any) => u.id === r.id);
            if (!latest) return r;

            if (
              latest.wait_minutes !== r.waitMinutes ||
              latest.last_called_at !== r.lastCalledAt
            ) {
              console.log(`⚡ ${r.name} updated → ${latest.wait_minutes} min`);
              return { ...r, waitMinutes: latest.wait_minutes, lastCalledAt: latest.last_called_at };
            }
            return r;
          })
        );
      } catch (err) {
        console.error("Error parsing live stream data:", err);
      }
    });

    es.addEventListener("error", () => {
      console.warn("❌ SSE connection lost, reconnecting in 5s...");
      es.close();
      esRef.current = null;
      reconnectTimerRef.current = setTimeout(connect, 5000);
    });
  }

  connect();

  return () => {
    console.log("🧹 Closing SSE connection");
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    esRef.current?.close();
    esRef.current = null;
  };
}, [dataLoaded]);

// COOLDOWN DISABLED (today)
// useEffect(() => {
//   const interval = setInterval(() => setNow(Date.now()), 10_000);
//   return () => clearInterval(interval);
// }, []);

  // Pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Refresh location first
      const location = await getCurrentLocation();
      if (location) {
        setUserLocation(location);
        console.log("🔄 Location refreshed:", location);
      }

      let url = `${API_BASE_URL}/restaurants`;
      const currentLocation = location || userLocation;
      if (currentLocation) {
        url += `?lat=${currentLocation.latitude}&lng=${currentLocation.longitude}`;
        if (showNearbyOnly) url += `&radius=50`;
      }

      const res = await fetch(url);

      if (!res.ok) {
        console.error("❌ Refresh failed:", res.status);
        Toast.show({
          type: 'error',
          text1: 'Refresh failed',
          text2: 'Please try again',
        });
        return;
      }

      const raw = await res.json();
      const restaurantArray = Array.isArray(raw) ? raw : (raw.data || []);

      const data: Restaurant[] = restaurantArray.map((r: any) => ({
        id: r.id,
        name: r.name,
        cuisine: r.cuisine || "Unknown",
        phone: r.phone,
        waitMinutes: r.wait_minutes,
        lastUpdatedAt: r.last_updated_at < 1e12 ? r.last_updated_at * 1000 : r.last_updated_at,
        image: r.image || 'https://via.placeholder.com/150',
        timezone: r.timezone,
        openHour: r.open_hour,
        closeHour: r.close_hour,
        lastCalledAt: r.last_called_at,
        // Location fields
        latitude: r.latitude,
        longitude: r.longitude,
        address: r.address,
        city: r.city,
        state: r.state,
        rating: r.rating,
        distance_miles: r.distance_miles,
      }));

      // Merge with existing state — the list endpoint may return null for
      // last_called_at, so always prefer local state for that.
      setRestaurants(prev => {
        const prevMap = new Map(prev.map(x => [x.id, x]));
        return data.map(r => {
          const existing = prevMap.get(r.id);
          if (!existing) return r;

          // Pick the most recent lastCalledAt, parsed as UTC
          const toUtcMs = (s: string | undefined) => {
            if (!s) return 0;
            const str = s.trim();
            const utc = str.endsWith('Z') || str.includes('+') || str.toUpperCase().includes('GMT')
              ? str : str + 'Z';
            return new Date(utc).getTime() || 0;
          };
          const lastCalledAt = toUtcMs(r.lastCalledAt) >= toUtcMs(existing.lastCalledAt)
            ? (r.lastCalledAt || existing.lastCalledAt)
            : existing.lastCalledAt;

          return { ...r, lastCalledAt };
        });
      });
      Toast.show({
        type: 'success',
        text1: 'Refreshed',
        text2: `${data.length} restaurants updated`,
      });
    } catch (err) {
      console.error("Failed to refresh:", err);
      Toast.show({
        type: 'error',
        text1: 'Refresh failed',
        text2: 'Check your connection',
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Available cuisines from restaurants
  const availableCuisines = useMemo(() => {
    const cuisines = new Set(restaurants.map(r => r.cuisine));
    return ["All", ...Array.from(cuisines).sort()];
  }, [restaurants]);

  // Search, cuisine, and nearby filter
  const filtered = useMemo(() => {
    let result = restaurants;
    const q = query.trim().toLowerCase();

    if (selectedCuisine !== "All") {
      result = result.filter((r) => r.cuisine === selectedCuisine);
    }

    if (showNearbyOnly && userLocation) {
      result = result.filter((r) =>
        r.distance_miles !== undefined &&
        r.distance_miles !== null &&
        r.distance_miles <= 10
      );
    }

    // Default radius when location is on — but keep all restaurants if none are in range
    // (avoids "No restaurants available" when user is far from the curated list).
    if (!q && userLocation) {
      const withinRadius = result.filter(
        (r) =>
          r.distance_miles !== undefined &&
          r.distance_miles !== null &&
          r.distance_miles <= 30
      );
      if (withinRadius.length > 0) {
        result = withinRadius;
      }
    }

    if (q) {
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.cuisine && r.cuisine.toLowerCase().includes(q))
      );
    }

    return result;
  }, [query, restaurants, selectedCuisine, showNearbyOnly, userLocation]);

  const handleRequest = async (r: Restaurant) => {
    setLoadingRestaurantId(r.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const res = await requestWaitTime(r, 4, {
        deviceId: deviceIdRef.current ?? undefined,
        pushToken: pushTokenRef.current ?? undefined,
        userLat: userLocation?.latitude,
        userLng: userLocation?.longitude,
      });

      console.log("✅ Call triggered:", res.call_sid, res);

      setRequested(r);
      setRecommendations(
        restaurants
          .filter((x) => x.id !== r.id)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3)
      );
      setModalOpen(true);

      Toast.show({
        type: 'success',
        text1: `Calling ${r.name}...`,
        text2: 'Usually takes 1-2 minutes',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      setTimeout(async () => {
        console.log("🔍 Fetching restaurant ID:", r.id);
        const latest = await fetchRestaurant(Number(r.id));

        if (latest) {
          console.log("📦 Got updated data from backend:", latest);

          setRestaurants(prev =>
            prev.map(x =>
              x.id === r.id
                ? {
                    ...x,
                    waitMinutes:
                      latest.wait_minutes !== undefined
                        ? latest.wait_minutes
                        : x.waitMinutes,
                    lastUpdatedAt: Date.now(),
                  }
                : x
            )
          );

          if (latest.wait_minutes !== null && latest.wait_minutes !== undefined) {
            Toast.show({
              type: 'success',
              text1: `Wait time ready!`,
              text2: `${r.name} has a ${latest.wait_minutes > 0 ? `${latest.wait_minutes} min wait` : 'no wait'}`,
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } else {
          console.warn("⚠️ No updated data from backend for", r.id);
        }

        setLoadingRestaurantId(null);
      }, 5000);
    } catch (err) {
      console.error("❌ Error while calling backend:", err);
      setLoadingRestaurantId(null);
      const message =
        err instanceof Error ? err.message : "Please try again";
      Toast.show({
        type: 'error',
        text1: 'Call not placed',
        text2: message,
      });
    }
  };  

  const renderItem = ({ item }: { item: Restaurant }) => {
    const minsSinceUpdate = minutesSince(item.lastUpdatedAt);
    const isLoading = loadingRestaurantId === item.id;

    return (
      <RestaurantCard
        restaurant={item}
        minutesSinceUpdate={minsSinceUpdate}
        secondsSinceCall={0}
        cooldownSeconds={0}
        canRequest={true}
        isLoading={isLoading}
        onRequest={() => handleRequest(item)}
      />
    );
  };
  
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <Text style={styles.logo}>🍽️ RushHR</Text>
        <Text style={styles.subtitle}>
          {userLocation ? "What's nearby?" : "Find a restaurant near you"}
        </Text>

        {/* Location Permission Banner */}
        {locationPermissionDenied && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>Enable location to see nearby restaurants</Text>
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Location Permission',
                  'Please enable location services in your device settings to see nearby restaurants.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Open Settings', onPress: () => Linking.openSettings() },
                  ]
                );
              }}
              style={styles.bannerButton}
            >
              <Text style={styles.bannerButtonText}>Settings</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.searchWrapper}>
          <TextInput
            placeholder="Search by name or cuisine"
            placeholderTextColor="#94A3B8"
            value={query}
            onChangeText={setQuery}
            style={styles.search}
          />
        </View>

        {/* Debug info */}
        {__DEV__ && (
          <Text style={styles.debug}>
            Restaurants: {restaurants.length} | Filtered: {filtered.length} | Location: {userLocation ? '✅' : '❌'}
          </Text>
        )}

        {/* Filters Button */}
        {(() => {
          const activeFilterCount = (selectedCuisine !== "All" ? 1 : 0) + (showNearbyOnly ? 1 : 0);
          return (
            <TouchableOpacity
              style={[styles.filtersButton, activeFilterCount > 0 && styles.filtersButtonActive]}
              onPress={() => {
                setFilterModalOpen(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.filtersIcon}>⚙</Text>
              <Text style={[styles.filtersText, activeFilterCount > 0 && styles.filtersTextActive]}>
                {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filters"}
              </Text>
            </TouchableOpacity>
          );
        })()}

        {/* Loading state */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F45B5B" />
            <Text style={styles.loadingText}>Loading restaurants...</Text>
          </View>
        ) : filtered.length === 0 ? (
          /* Empty state */
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {query || selectedCuisine !== "All" || showNearbyOnly
                ? "No restaurants found"
                : locationPermissionDenied
                ? "Enable location to see nearby restaurants"
                : "No restaurants available"}
            </Text>
            <Text style={styles.emptySubtext}>
              {query || selectedCuisine !== "All" || showNearbyOnly
                ? "Try a different search or filter"
                : "Pull down to refresh"}
            </Text>
          </View>
        ) : (
          /* Restaurant list */
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            // extraData={now} // COOLDOWN DISABLED (today)
            contentContainerStyle={{ paddingBottom: 32 }}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#F45B5B"
                colors={["#F45B5B"]}
              />
            }
          />
        )}

        <FilterModal
          visible={filterModalOpen}
          onClose={() => setFilterModalOpen(false)}
          selectedCuisine={selectedCuisine}
          showNearbyOnly={showNearbyOnly}
          availableCuisines={availableCuisines}
          hasLocation={!!userLocation}
          onApply={(cuisine, nearby) => {
            setSelectedCuisine(cuisine);
            setShowNearbyOnly(nearby);
            setFilterModalOpen(false);
          }}
        />
        <RequestModal
          visible={modalOpen}
          onClose={() => setModalOpen(false)}
          requested={requested}
          recommendations={recommendations}
        />
        <Toast />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 12,
  },
  logo: {
    fontSize: 28,
    fontWeight: "800",
    marginTop: 8,
    color: "#0F172A",
  },
  subtitle: {
    color: "#475569",
    marginBottom: 8,
  },
  banner: {
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  bannerText: {
    color: "#92400E",
    fontSize: 14,
    flex: 1,
    fontWeight: "600",
  },
  bannerButton: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  bannerButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E2E8F0",
  },
  search: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  debug: {
    fontSize: 11,
    color: "#10B981",
    backgroundColor: "#F0FDF4",
    padding: 6,
    borderRadius: 6,
    fontWeight: "600",
  },
  filtersButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  filtersButtonActive: {
    backgroundColor: "#FEF2F2",
    borderColor: "#F45B5B",
  },
  filtersIcon: {
    fontSize: 14,
    color: "#64748B",
  },
  filtersText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
  },
  filtersTextActive: {
    color: "#F45B5B",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: "#64748B",
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
  },
});
