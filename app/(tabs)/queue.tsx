import EditQueueProfileModal from '@/components/queue/EditQueueProfileModal';
import JoinQueueModal from '@/components/queue/JoinQueueModal';
import LocationCard from '@/components/queue/LocationCard';
import SaveProfilePrompt from '@/components/queue/SaveProfilePrompt';
import { QUEUE_COLORS } from '@/constants/queueTheme';
import { useQueueNotifications } from '@/hooks/useQueueNotifications';
import { fetchActiveQueueEntries, fetchLocations, joinQueue } from '@/utils/queueApi';
import { QueueApiError } from '@/utils/queueErrors';
import { MAX_ACTIVE_QUEUES } from '@/utils/queueLimits';
import {
  clearQueueProfile,
  getSavedQueueProfile,
  hasSeenSaveProfilePrompt,
  markSaveProfilePromptSeen,
  QueueGuestProfile,
  saveQueueProfile,
  toQueueProfile,
} from '@/utils/queueProfile';
import { setActiveQueueEntry } from '@/utils/queueSession';
import { BusinessLocation } from '@/utils/queueTypes';
import { getDeviceId, registerForPushNotifications } from '@/utils/notifications';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

export default function QueueScreen() {
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<BusinessLocation | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [activeByLocation, setActiveByLocation] = useState<Record<number, number>>({});
  const [savedProfile, setSavedProfile] = useState<QueueGuestProfile | null>(null);
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [pendingJoinEntryId, setPendingJoinEntryId] = useState<number | null>(null);
  const [pendingJoinData, setPendingJoinData] = useState<{
    name: string;
    contact: string;
    partySize: number;
  } | null>(null);
  const pushTokenRef = useRef<string | null>(null);

  useQueueNotifications(deviceId);

  const loadActiveEntries = useCallback(async (id: string) => {
    try {
      const entries = await fetchActiveQueueEntries(id);
      const map: Record<number, number> = {};
      for (const entry of entries) {
        map[entry.locationId] = entry.id;
      }
      setActiveByLocation(map);
    } catch {
      setActiveByLocation({});
    }
  }, []);

  const loadLocations = useCallback(async () => {
    try {
      const data = await fetchLocations();
      setLocations(data);
      if (deviceId) await loadActiveEntries(deviceId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const isNetwork =
        message.includes('Network request failed') || message.includes('Failed to fetch');
      Toast.show({
        type: 'error',
        text1: 'Could not load locations',
        text2: isNetwork
          ? 'Check EXPO_PUBLIC_QUEUE_API_URL and your connection'
          : message,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deviceId, loadActiveEntries]);

  useFocusEffect(
    useCallback(() => {
      if (deviceId) loadActiveEntries(deviceId);
    }, [deviceId, loadActiveEntries])
  );

  useEffect(() => {
    async function init() {
      const id = await getDeviceId();
      setDeviceId(id);
      pushTokenRef.current = await registerForPushNotifications();
      setSavedProfile(await getSavedQueueProfile());
      await loadActiveEntries(id);
      await loadLocations();
    }
    init();

    const interval = setInterval(() => {
      loadLocations();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadLocations, loadActiveEntries]);

  const goToQueueStatus = (entryId: number) => {
    setActiveQueueEntry(entryId);
    router.push(`/queue/${entryId}`);
  };

  const handleJoin = async (data: { name: string; contact: string; partySize: number }) => {
    if (!selectedLocation) return;
    setJoining(true);
    try {
      const entry = await joinQueue({
        locationId: selectedLocation.id,
        customerName: data.name,
        customerContact: data.contact,
        partySize: data.partySize,
        deviceId: deviceId ?? undefined,
        pushToken: pushTokenRef.current ?? undefined,
      });
      setActiveQueueEntry(entry.id);
      setActiveByLocation((prev) => ({ ...prev, [selectedLocation.id]: entry.id }));
      setModalOpen(false);
      Toast.show({ type: 'success', text1: 'Joined queue!', text2: `Position #${entry.position}` });

      const existingProfile = await getSavedQueueProfile();
      const promptSeen = await hasSeenSaveProfilePrompt();
      if (!existingProfile && !promptSeen) {
        setPendingJoinEntryId(entry.id);
        setPendingJoinData(data);
        setSavePromptOpen(true);
      } else {
        goToQueueStatus(entry.id);
      }
    } catch (err) {
      if (err instanceof QueueApiError && err.existingEntryId) {
        setActiveByLocation((prev) => ({
          ...prev,
          [selectedLocation.id]: err.existingEntryId!,
        }));
        Toast.show({
          type: 'info',
          text1: 'Already in this queue',
          text2: 'Taking you to your current spot',
        });
        goToQueueStatus(err.existingEntryId);
        return;
      }
      if (err instanceof QueueApiError && err.code === 'MAX_QUEUES_REACHED') {
        Toast.show({
          type: 'error',
          text1: 'Queue limit reached',
          text2: `You can only be in ${MAX_ACTIVE_QUEUES} queues at once. Leave one to join another.`,
        });
        return;
      }
      Toast.show({
        type: 'error',
        text1: 'Could not join queue',
        text2: err instanceof Error ? err.message : 'Please try again',
      });
    } finally {
      setJoining(false);
    }
  };

  const finishSavePrompt = (entryId: number) => {
    setSavePromptOpen(false);
    setPendingJoinEntryId(null);
    setPendingJoinData(null);
    goToQueueStatus(entryId);
  };

  const handleSaveProfileYes = async () => {
    if (pendingJoinData) {
      const profile = toQueueProfile(pendingJoinData);
      if (profile) {
        await saveQueueProfile(profile);
        setSavedProfile(profile);
      }
    } else {
      await markSaveProfilePromptSeen();
    }
    if (pendingJoinEntryId) finishSavePrompt(pendingJoinEntryId);
  };

  const handleSaveProfileNo = async () => {
    await markSaveProfilePromptSeen();
    if (pendingJoinEntryId) finishSavePrompt(pendingJoinEntryId);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Join a Queue</Text>
          <Text style={styles.subtitle}>Skip the line — join remotely</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => setEditProfileOpen(true)}
            accessibilityLabel="Edit my queue details"
          >
            <Ionicons name="person-circle-outline" size={22} color={QUEUE_COLORS.text} />
            <Text style={styles.detailsBtnText}>My Details</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={QUEUE_COLORS.primary} />
          <Text style={styles.loadingText}>Loading locations...</Text>
        </View>
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <LocationCard
              location={item}
              activeEntryId={activeByLocation[item.id]}
              onJoin={() => {
                if (activeByLocation[item.id]) {
                  goToQueueStatus(activeByLocation[item.id]);
                  return;
                }
                if (Object.keys(activeByLocation).length >= MAX_ACTIVE_QUEUES) {
                  Toast.show({
                    type: 'error',
                    text1: 'Queue limit reached',
                    text2: `You can only be in ${MAX_ACTIVE_QUEUES} queues at once. Leave one to join another.`,
                  });
                  return;
                }
                setSelectedLocation(item);
                setModalOpen(true);
              }}
              onViewQueue={() => goToQueueStatus(activeByLocation[item.id])}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadLocations();
              }}
              tintColor={QUEUE_COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>No participating locations yet.</Text>
              <TouchableOpacity onPress={loadLocations} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <JoinQueueModal
        visible={modalOpen}
        location={selectedLocation}
        savedProfile={savedProfile}
        onClose={() => setModalOpen(false)}
        onSubmit={handleJoin}
        submitting={joining}
      />

      <SaveProfilePrompt
        visible={savePromptOpen}
        onSave={handleSaveProfileYes}
        onDecline={handleSaveProfileNo}
      />

      <EditQueueProfileModal
        visible={editProfileOpen}
        profile={savedProfile}
        onClose={() => setEditProfileOpen(false)}
        onSave={async (profile) => {
          await saveQueueProfile(profile);
          setSavedProfile(profile);
          setEditProfileOpen(false);
          Toast.show({ type: 'success', text1: 'Details saved' });
        }}
        onClear={async () => {
          await clearQueueProfile();
          setSavedProfile(null);
          setEditProfileOpen(false);
          Toast.show({ type: 'info', text1: 'Saved details removed' });
        }}
      />
      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QUEUE_COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  headerActions: {
    paddingTop: 4,
  },
  detailsBtn: {
    alignItems: 'center',
    gap: 2,
  },
  detailsBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: QUEUE_COLORS.textSecondary,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: QUEUE_COLORS.text,
  },
  subtitle: {
    fontSize: 15,
    color: QUEUE_COLORS.textSecondary,
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  loadingText: {
    marginTop: 12,
    color: QUEUE_COLORS.textSecondary,
    fontSize: 15,
  },
  emptyText: {
    color: QUEUE_COLORS.textSecondary,
    fontSize: 16,
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: QUEUE_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: '#FFF',
    fontWeight: '700',
  },
});
