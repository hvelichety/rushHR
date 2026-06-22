import CodeSearchPanel from '@/components/queue/CodeSearchPanel';
import QueueControls from '@/components/queue/QueueControls';
import QueueEntryRow from '@/components/queue/QueueEntryRow';
import TimeSlotStaffPanel from '@/components/timeslots/TimeSlotStaffPanel';
import { QUEUE_COLORS } from '@/constants/queueTheme';
import {
  callNextCustomer,
  fetchLocationQueue,
  fetchLocations,
  markNoShow,
  markServed,
  removeQueueEntry,
  updateLocationSettings,
  verifyCheckInCode,
} from '@/utils/queueApi';
import { BusinessLocation, QueueEntry } from '@/utils/queueTypes';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
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

export default function StaffDashboardScreen() {
  const [staffMode, setStaffMode] = useState<'queue' | 'timeslots'>('queue');
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [location, setLocation] = useState<BusinessLocation | null>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [callingNext, setCallingNext] = useState(false);
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [serviceTime, setServiceTime] = useState('2');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyResult, setVerifyResult] = useState<{
    verified: boolean;
    entry: QueueEntry | null;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const loadLocations = useCallback(async () => {
    try {
      const data = await fetchLocations(true);
      setLocations(data);
      if (!selectedLocationId && data.length > 0) {
        setSelectedLocationId(data[0].id);
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Could not load locations',
        text2: err instanceof Error ? err.message : undefined,
      });
    }
  }, [selectedLocationId]);

  const loadQueue = useCallback(async () => {
    if (!selectedLocationId) return;
    try {
      const data = await fetchLocationQueue(selectedLocationId);
      setLocation(data.location);
      setQueue(data.queue);
      setServiceTime(String(data.location.averageServiceTimeMinutes));
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Could not load queue',
        text2: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedLocationId]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    if (selectedLocationId) {
      setLoading(true);
      loadQueue();
      const interval = setInterval(loadQueue, 4000);
      return () => clearInterval(interval);
    }
  }, [selectedLocationId, loadQueue]);

  const handleCallNext = async () => {
    if (!selectedLocationId) return;
    setCallingNext(true);
    try {
      await callNextCustomer(selectedLocationId);
      Toast.show({ type: 'success', text1: 'Customer called' });
      await loadQueue();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Call next failed',
        text2: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setCallingNext(false);
    }
  };

  const handlePause = async () => {
    if (!selectedLocationId) return;
    setUpdatingSettings(true);
    try {
      await updateLocationSettings(selectedLocationId, { isQueueOpen: false });
      await loadQueue();
      Toast.show({ type: 'info', text1: 'Queue paused' });
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleResume = async () => {
    if (!selectedLocationId) return;
    setUpdatingSettings(true);
    try {
      await updateLocationSettings(selectedLocationId, { isQueueOpen: true });
      await loadQueue();
      Toast.show({ type: 'success', text1: 'Queue resumed' });
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleUpdateServiceTime = async () => {
    if (!selectedLocationId) return;
    const minutes = parseFloat(serviceTime);
    if (Number.isNaN(minutes) || minutes <= 0) {
      Toast.show({ type: 'error', text1: 'Enter a valid service time' });
      return;
    }
    setUpdatingSettings(true);
    try {
      await updateLocationSettings(selectedLocationId, {
        averageServiceTimeMinutes: minutes,
      });
      await loadQueue();
      Toast.show({ type: 'success', text1: 'Service time updated' });
    } finally {
      setUpdatingSettings(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedLocationId || verifyCode.length < 4) return;
    setVerifying(true);
    try {
      const result = await verifyCheckInCode(selectedLocationId, verifyCode);
      setVerifyResult(result);
    } finally {
      setVerifying(false);
    }
  };

  const handleMarkServed = async (entryId: number) => {
    try {
      await markServed(entryId);
      await loadQueue();
      Toast.show({ type: 'success', text1: 'Marked as served' });
    } catch (err) {
      Toast.show({ type: 'error', text1: err instanceof Error ? err.message : 'Failed' });
    }
  };

  const handleMarkNoShow = async (entryId: number) => {
    try {
      await markNoShow(entryId);
      await loadQueue();
      Toast.show({ type: 'info', text1: 'Marked as no-show' });
    } catch (err) {
      Toast.show({ type: 'error', text1: err instanceof Error ? err.message : 'Failed' });
    }
  };

  const handleRemove = async (entryId: number) => {
    try {
      await removeQueueEntry(entryId);
      await loadQueue();
      Toast.show({ type: 'info', text1: 'Customer removed' });
    } catch (err) {
      Toast.show({ type: 'error', text1: err instanceof Error ? err.message : 'Failed' });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Staff Dashboard</Text>
          <Text style={styles.subtitle}>Manage live queue</Text>
        </View>
        <View style={styles.iconBadge}>
          <Ionicons name="briefcase-outline" size={22} color={QUEUE_COLORS.info} />
        </View>
      </View>

      <View style={styles.modePicker}>
        <TouchableOpacity
          style={[styles.modeChip, staffMode === 'queue' && styles.modeChipActive]}
          onPress={() => setStaffMode('queue')}
        >
          <Text style={[styles.modeChipText, staffMode === 'queue' && styles.modeChipTextActive]}>
            Queue
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeChip, staffMode === 'timeslots' && styles.modeChipActive]}
          onPress={() => setStaffMode('timeslots')}
        >
          <Text
            style={[styles.modeChipText, staffMode === 'timeslots' && styles.modeChipTextActive]}
          >
            TimeSlots
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.locationPicker}>
        {locations.map((loc) => (
          <TouchableOpacity
            key={loc.id}
            style={[styles.locChip, selectedLocationId === loc.id && styles.locChipActive]}
            onPress={() => setSelectedLocationId(loc.id)}
          >
            <Text
              style={[
                styles.locChipText,
                selectedLocationId === loc.id && styles.locChipTextActive,
              ]}
              numberOfLines={1}
            >
              {loc.name.split(' ')[0]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading || !location ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={QUEUE_COLORS.primary} />
        </View>
      ) : staffMode === 'timeslots' ? (
        <TimeSlotStaffPanel
          locationId={selectedLocationId!}
          locationName={location.name}
        />
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={
            <>
              <QueueControls
                location={location}
                serviceTime={serviceTime}
                onServiceTimeChange={setServiceTime}
                onUpdateServiceTime={handleUpdateServiceTime}
                onPause={handlePause}
                onResume={handleResume}
                onCallNext={handleCallNext}
                callingNext={callingNext}
                updatingSettings={updatingSettings}
              />
              <CodeSearchPanel
                code={verifyCode}
                onCodeChange={(c) => {
                  setVerifyCode(c);
                  setVerifyResult(null);
                }}
                onVerify={handleVerify}
                verifying={verifying}
                result={verifyResult}
              />
              <Text style={styles.sectionTitle}>Live Queue ({queue.length})</Text>
            </>
          }
          renderItem={({ item }) => (
            <QueueEntryRow
              entry={item}
              onMarkServed={() => handleMarkServed(item.id)}
              onMarkNoShow={() => handleMarkNoShow(item.id)}
              onRemove={() => handleRemove(item.id)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadQueue();
              }}
              tintColor={QUEUE_COLORS.primary}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>No customers in queue</Text>
          }
        />
      )}
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: QUEUE_COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: QUEUE_COLORS.textSecondary,
    marginTop: 2,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePicker: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 10,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: QUEUE_COLORS.card,
    borderWidth: 1,
    borderColor: QUEUE_COLORS.border,
    alignItems: 'center',
  },
  modeChipActive: {
    backgroundColor: QUEUE_COLORS.primary,
    borderColor: QUEUE_COLORS.primary,
  },
  modeChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: QUEUE_COLORS.textSecondary,
  },
  modeChipTextActive: {
    color: '#FFF',
  },
  locationPicker: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
    flexWrap: 'wrap',
  },
  locChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: QUEUE_COLORS.card,
    borderWidth: 1,
    borderColor: QUEUE_COLORS.border,
  },
  locChipActive: {
    backgroundColor: QUEUE_COLORS.primary,
    borderColor: QUEUE_COLORS.primary,
  },
  locChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: QUEUE_COLORS.textSecondary,
    maxWidth: 100,
  },
  locChipTextActive: {
    color: '#FFF',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: QUEUE_COLORS.text,
    marginBottom: 10,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: QUEUE_COLORS.textMuted,
    fontSize: 15,
    paddingVertical: 24,
  },
});
