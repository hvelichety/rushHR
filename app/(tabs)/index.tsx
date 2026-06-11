import { EventSourcePolyfill } from "event-source-polyfill";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import AskRestaurantModal from "../../components/AskRestaurantModal";
import FilterModal from "../../components/FilterModal";
import RequestModal from "../../components/RequestModal";
import RestaurantCard from "../../components/RestaurantCard";
import UpdatesFeed from "../../components/UpdatesFeed";
import { fetchRestaurant } from "../../utils/api";
import { createRestaurantCall, fetchVoiceCall, getVoiceApiConfigError, pollVoiceCallUntilDone } from "../../utils/voiceApi";
import { API_BASE_URL, NEARBY_RADIUS_MILES, RESTAURANT_API_BASE_URL } from "../../utils/config";
import { mapApiRestaurant, searchRestaurantsLive } from "../../utils/restaurantSearchApi";
import { minutesSince } from "../../utils/time";
import { Restaurant } from "../../utils/types";
const EventSource = EventSourcePolyfill;

import {
  getCurrentLocation,
  requestLocationPermission,
  UserLocation,
} from "../../utils/location";

/** lat/lng for distance; sync=1 pulls from Yelp; radius only when "Nearby Only" */
function buildRestaurantsUrl(
  userLocation: UserLocation | null,
  showNearbyOnly: boolean,
  options?: { sync?: boolean; location?: string }
): string {
  let url = `${RESTAURANT_API_BASE_URL}/restaurants`;
  const params = new URLSearchParams();

  if (options?.sync !== false) {
    params.set("sync", "1");
  }
  params.set("sort", "popularity");

  if (options?.location?.trim()) {
    params.set("location", options.location.trim());
  } else if (userLocation) {
    params.set("lat", String(userLocation.latitude));
    params.set("lng", String(userLocation.longitude));
  }

  if (showNearbyOnly && userLocation) {
    params.set("radius", String(NEARBY_RADIUS_MILES));
  }

  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

import {
  getDeviceId,
  registerForPushNotifications,
  registerPushToken,
  setupNotificationListeners,
} from "../../utils/notifications";
import { handledVoiceCallIds, useQueueNotifications } from "../../hooks/useQueueNotifications";
import { useCallUpdates } from "../../hooks/useCallUpdates";
import { CallUpdate } from "../../utils/callUpdates";



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

  // ask / call modal state
  const [askModalOpen, setAskModalOpen] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [requested, setRequested] = useState<Restaurant | null>(null);
  const [recommendations, setRecommendations] = useState<Restaurant[]>([]);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<'calling' | 'completed' | 'failed'>('calling');
  const [answerSummary, setAnswerSummary] = useState<string | null>(null);
  const [placingCall, setPlacingCall] = useState(false);
  const [activeCallRestaurantId, setActiveCallRestaurantId] = useState<number | null>(null);

  // const [now, setNow] = useState(Date.now()); // COOLDOWN DISABLED (today)
  const deviceIdRef = useRef<string | null>(null);
  const pushTokenRef = useRef<string | null>(null);
  const searchRequestRef = useRef(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Restaurant[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const {
    updates: callUpdates,
    loading: updatesLoading,
    refreshUpdates,
    upsertCall,
    markRead,
  } = useCallUpdates(deviceId);
  // Cooldown disabled: every tap triggers a call request

  const isSearching = query.trim().length >= 2;

  const openVoiceCallResult = useCallback(async (callId: number) => {
    try {
      const result = await fetchVoiceCall(callId);
      handledVoiceCallIds.add(callId);
      markRead(callId);
      upsertCall(result);

      let restaurant =
        restaurants.find((x) => x.id === result.restaurantId) ?? null;
      if (!restaurant) {
        const raw = await fetchRestaurant(result.restaurantId);
        if (raw?.data) restaurant = mapApiRestaurant(raw.data);
        else if (raw) restaurant = mapApiRestaurant(raw);
      }
      if (!restaurant) {
        restaurant = {
          id: result.restaurantId,
          name: 'Restaurant',
          cuisine: 'Unknown',
          phone: '',
          waitMinutes: 0,
          lastUpdatedAt: Date.now(),
          image: 'https://via.placeholder.com/150',
        };
      }

      setRequested(restaurant);
      setActiveQuestion(result.questionForRestaurant);
      setCallStatus(result.status === 'completed' ? 'completed' : 'failed');
      setAnswerSummary(result.answerSummary ?? result.errorMessage ?? null);
      setRecommendations(
        restaurants
          .filter((x) => x.id !== restaurant!.id)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3)
      );
      setModalOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load your update';
      Toast.show({ type: 'error', text1: 'Update unavailable', text2: message });
    }
  }, [restaurants, markRead, upsertCall]);

  const openUpdateDetail = useCallback(
    (update: CallUpdate) => {
      markRead(update.callId);
      void openVoiceCallResult(update.callId);
    },
    [markRead, openVoiceCallResult]
  );

  useQueueNotifications(deviceId);

  // Push notifications
  useEffect(() => {
    async function setupPushNotifications() {
      const id = await getDeviceId();
      deviceIdRef.current = id;
      setDeviceId(id);
      const token = await registerForPushNotifications();
      if (token) {
        pushTokenRef.current = token;
        await registerPushToken(id, token);
        console.log('🔔 Push notifications registered');
      }
    }

    setupPushNotifications();

    const cleanup = setupNotificationListeners((data) => {
      if (data.type === 'voice_call_ready' && data.callId) {
        void openVoiceCallResult(Number(data.callId));
        return;
      }
      console.log('👆 Notification tapped:', data);
    });

    return cleanup;
  }, [openVoiceCallResult]);

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
        const url = buildRestaurantsUrl(userLocation, showNearbyOnly);

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
          review_count: r.review_count,
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
        const url = buildRestaurantsUrl(userLocation, showNearbyOnly);
        console.log("📡 Fetching restaurants:", url);

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
          review_count: r.review_count,
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
    void refreshUpdates();
    try {
      // Refresh location first
      const location = await getCurrentLocation();
      if (location) {
        setUserLocation(location);
        console.log("🔄 Location refreshed:", location);
      }

      const currentLocation = location || userLocation;
      const url = buildRestaurantsUrl(currentLocation, showNearbyOnly);

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
        review_count: r.review_count,
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

  // Browse list (popular nearby) — no text search filter here
  const browseList = useMemo(() => {
    let result = restaurants;

    if (selectedCuisine !== "All") {
      result = result.filter((r) => r.cuisine === selectedCuisine);
    }

    if (showNearbyOnly && userLocation) {
      result = result.filter(
        (r) =>
          r.distance_miles !== undefined &&
          r.distance_miles !== null &&
          r.distance_miles <= NEARBY_RADIUS_MILES
      );
    }

    if (userLocation && !showNearbyOnly) {
      result = [...result].sort((a, b) => {
        const reviewsA = a.review_count ?? 0;
        const reviewsB = b.review_count ?? 0;
        if (reviewsB !== reviewsA) return reviewsB - reviewsA;
        const ratingA = a.rating ?? 0;
        const ratingB = b.rating ?? 0;
        if (ratingB !== ratingA) return ratingB - ratingA;
        const da = a.distance_miles ?? Number.POSITIVE_INFINITY;
        const db = b.distance_miles ?? Number.POSITIVE_INFINITY;
        return da - db;
      });
    } else if (!userLocation) {
      result = [...result].sort((a, b) => {
        const reviewsA = a.review_count ?? 0;
        const reviewsB = b.review_count ?? 0;
        if (reviewsB !== reviewsA) return reviewsB - reviewsA;
        return (b.rating ?? 0) - (a.rating ?? 0);
      });
    }

    return result;
  }, [restaurants, selectedCuisine, showNearbyOnly, userLocation]);

  // Search mode uses dedicated Yelp results; browse mode uses popular list
  const displayList = useMemo(() => {
    let result = isSearching ? searchResults : browseList;

    if (isSearching && selectedCuisine !== "All") {
      result = result.filter((r) => r.cuisine === selectedCuisine);
    }

    if (isSearching && showNearbyOnly && userLocation) {
      result = result.filter(
        (r) =>
          r.distance_miles !== undefined &&
          r.distance_miles !== null &&
          r.distance_miles <= NEARBY_RADIUS_MILES
      );
    }

    return result;
  }, [isSearching, searchResults, browseList, selectedCuisine, showNearbyOnly, userLocation]);

  // Live Yelp search when typing a restaurant name
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const requestId = ++searchRequestRef.current;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const incoming = await searchRestaurantsLive(q, userLocation);
        if (searchRequestRef.current !== requestId) return;

        setSearchResults(incoming);
        setRestaurants((prev) => {
          const byId = new Map(prev.map((r) => [r.id, r]));
          for (const r of incoming) {
            byId.set(r.id, { ...byId.get(r.id), ...r });
          }
          return Array.from(byId.values());
        });
      } catch (err) {
        if (searchRequestRef.current !== requestId) return;
        console.warn("Restaurant search failed:", err);
        setSearchResults([]);
      } finally {
        if (searchRequestRef.current === requestId) {
          setSearchLoading(false);
        }
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, userLocation]);

  const handleOpenAsk = (r: Restaurant) => {
    setSelectedRestaurant(r);
    setAskModalOpen(true);
  };

  const handleSubmitQuestion = async (question: string) => {
    const r = selectedRestaurant;
    if (!r) return;

    setPlacingCall(true);
    setLoadingRestaurantId(r.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const configError = getVoiceApiConfigError();
    if (configError) {
      Toast.show({ type: 'error', text1: 'Voice API not configured', text2: configError });
      setLoadingRestaurantId(null);
      setPlacingCall(false);
      return;
    }

    try {
      const call = await createRestaurantCall({
        restaurantId: Number(r.id),
        questionForRestaurant: question,
        deviceId: deviceIdRef.current ?? undefined,
        pushToken: pushTokenRef.current ?? undefined,
      });

      if (!call.vapiCallId) {
        throw new Error('Server accepted the request but Vapi did not confirm a call.');
      }

      setAskModalOpen(false);
      setRequested(r);
      setActiveQuestion(question);
      setCallStatus('calling');
      setAnswerSummary(null);
      setRecommendations(
        restaurants
          .filter((x) => x.id !== r.id)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3)
      );
      setModalOpen(true);
      setLoadingRestaurantId(null);
      setActiveCallRestaurantId(r.id);
      upsertCall({ ...call, restaurantName: r.name }, r.name);

      Toast.show({
        type: 'success',
        text1: `Calling ${r.name}...`,
        text2: call.fromPhoneNumber
          ? `Add ${call.fromPhoneNumber} to Contacts if it doesn't ring`
          : 'Our AI is asking your question',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      void (async () => {
        try {
          const result = await pollVoiceCallUntilDone(call.id);
          handledVoiceCallIds.add(result.id);
          upsertCall({ ...result, restaurantName: r.name }, r.name);
          setCallStatus(result.status === 'completed' ? 'completed' : 'failed');
          setAnswerSummary(result.answerSummary ?? result.errorMessage ?? null);

          if (result.status === 'completed') {
            Toast.show({
              type: 'success',
              text1: 'Your update is ready',
              text2: 'Tap to see what they said',
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            Toast.show({
              type: 'error',
              text1: 'Could not get an answer',
              text2: result.errorMessage || 'Try again in a moment',
            });
          }

          if (result.waitMinutes !== null && result.waitMinutes !== undefined) {
            setRestaurants((prev) =>
              prev.map((x) =>
                x.id === r.id
                  ? { ...x, waitMinutes: result.waitMinutes!, lastUpdatedAt: Date.now() }
                  : x
              )
            );
          } else {
            const latest = await fetchRestaurant(Number(r.id));
            if (latest?.wait_minutes !== undefined && latest?.wait_minutes !== null) {
              setRestaurants((prev) =>
                prev.map((x) =>
                  x.id === r.id
                    ? {
                        ...x,
                        waitMinutes: latest.wait_minutes,
                        lastUpdatedAt: Date.now(),
                      }
                    : x
                )
              );
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Still waiting for an answer';
          setCallStatus('failed');
          setAnswerSummary(message);
          Toast.show({
            type: 'error',
            text1: 'Call did not finish',
            text2: message,
          });
        } finally {
          setActiveCallRestaurantId(null);
        }
      })();
    } catch (err) {
      console.error('❌ Error placing restaurant call:', err);
      setLoadingRestaurantId(null);
      setActiveCallRestaurantId(null);
      setModalOpen(false);
      const message = err instanceof Error ? err.message : 'Please try again';
      Toast.show({
        type: 'error',
        text1: 'Call not placed',
        text2: message,
      });
    } finally {
      setPlacingCall(false);
    }
  };

  const renderItem = ({ item }: { item: Restaurant }) => {
    const minsSinceUpdate = minutesSince(item.lastUpdatedAt);
    const isLoading = loadingRestaurantId === item.id;
    const isOnCall = activeCallRestaurantId === item.id;

    return (
      <RestaurantCard
        restaurant={item}
        minutesSinceUpdate={minsSinceUpdate}
        secondsSinceCall={0}
        cooldownSeconds={0}
        canRequest={true}
        isLoading={isLoading}
        isOnCall={isOnCall}
        onRequest={() => handleOpenAsk(item)}
      />
    );
  };
  
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <Text style={styles.logo}>🍽️ RushHour</Text>
        <Text style={styles.subtitle}>
          {userLocation
            ? "Popular spots near you — search any restaurant"
            : "Search a restaurant name to call"}
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
            placeholder="Search restaurant, cuisine, or city"
            placeholderTextColor="#94A3B8"
            value={query}
            onChangeText={setQuery}
            style={styles.search}
          />
          {searchLoading && (
            <ActivityIndicator size="small" color="#F45B5B" style={styles.searchSpinner} />
          )}
        </View>

        {/* Debug info */}
        {__DEV__ && (
          <Text style={styles.debug}>
            Restaurants: {restaurants.length} | Showing: {displayList.length} | {isSearching ? 'Search' : 'Browse'} | Location: {userLocation ? '✅' : '❌'}
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

        <FlatList
          data={loading && !isSearching ? [] : displayList}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          ListHeaderComponent={
            <View style={styles.updatesSection}>
              <UpdatesFeed
                updates={callUpdates}
                loading={updatesLoading}
                onSelectUpdate={openUpdateDetail}
              />
            </View>
          }
          contentContainerStyle={
            displayList.length === 0 && !loading
              ? { flexGrow: 1, paddingBottom: 32 }
              : { paddingBottom: 32 }
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            loading && !isSearching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#F45B5B" />
                <Text style={styles.loadingText}>Loading restaurants...</Text>
              </View>
            ) : searchLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#F45B5B" />
                <Text style={styles.loadingText}>Searching for "{query.trim()}"...</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {isSearching
                    ? `No restaurants found for "${query.trim()}"`
                    : query || selectedCuisine !== "All" || showNearbyOnly
                      ? "No restaurants found"
                      : locationPermissionDenied
                        ? "Enable location to see nearby restaurants"
                        : "No restaurants available"}
                </Text>
                <Text style={styles.emptySubtext}>
                  {isSearching
                    ? "Try the full name or add the city"
                    : query || selectedCuisine !== "All" || showNearbyOnly
                      ? "Try a different search or filter"
                      : "Pull down to refresh"}
                </Text>
              </View>
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#F45B5B"
              colors={["#F45B5B"]}
            />
          }
        />

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
        <AskRestaurantModal
          visible={askModalOpen}
          restaurant={selectedRestaurant}
          onClose={() => setAskModalOpen(false)}
          onSubmit={handleSubmitQuestion}
          submitting={placingCall}
        />
        <RequestModal
          visible={modalOpen}
          onClose={() => setModalOpen(false)}
          requested={requested}
          recommendations={recommendations}
          question={activeQuestion}
          callStatus={callStatus}
          answerSummary={answerSummary}
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
  updatesSection: {
    marginBottom: 12,
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
  searchSpinner: {
    marginRight: 12,
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
