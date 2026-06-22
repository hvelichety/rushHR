import BookSlotModal from '@/components/timeslots/BookSlotModal';
import MySlotCard from '@/components/timeslots/MySlotCard';
import TimeSlotCard from '@/components/timeslots/TimeSlotCard';
import EditQueueProfileModal from '@/components/queue/EditQueueProfileModal';
import { SLOT_COLORS } from '@/constants/timeSlotTheme';
import { fetchLocations } from '@/utils/queueApi';
import { QueueApiError } from '@/utils/queueErrors';
import {
  clearQueueProfile,
  getSavedQueueProfile,
  QueueGuestProfile,
  saveQueueProfile,
} from '@/utils/queueProfile';
import { BusinessLocation } from '@/utils/queueTypes';
import { getDeviceId } from '@/utils/notifications';
import {
  bookTimeSlot,
  cancelTimeSlotBooking,
  fetchActiveTimeSlotBooking,
  fetchTimeSlots,
} from '@/utils/timeSlotApi';
import {
  clearActiveTimeSlotBooking,
  setActiveTimeSlotBooking,
} from '@/utils/timeSlotSession';
import { TimeSlot, TimeSlotBooking } from '@/utils/timeSlotTypes';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router, Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

export default function TimeSlotsScreen() {
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [activeBooking, setActiveBooking] = useState<TimeSlotBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [savedProfile, setSavedProfile] = useState<QueueGuestProfile | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [booking, setBooking] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const selectedLocation = locations.find((l) => l.id === selectedLocationId) || null;

  const loadActiveBooking = useCallback(async (id: string) => {
    try {
      const booking = await fetchActiveTimeSlotBooking(id);
      setActiveBooking(booking);
      if (booking) await setActiveTimeSlotBooking(booking.id);
      else await clearActiveTimeSlotBooking();
    } catch {
      setActiveBooking(null);
    }
  }, []);

  const loadLocations = useCallback(async () => {
    try {
      const data = await fetchLocations();
      setLocations(data);
      if (data.length > 0 && !selectedLocationId) {
        setSelectedLocationId(data[0].id);
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Could not load locations',
        text2: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedLocationId]);

  const loadSlots = useCallback(async (locationId: number) => {
    setSlotsLoading(true);
    try {
      setSlots(await fetchTimeSlots(locationId));
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Could not load time slots',
        text2: err instanceof Error ? err.message : undefined,
      });
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (deviceId) loadActiveBooking(deviceId);
    }, [deviceId, loadActiveBooking])
  );

  useEffect(() => {
    async function init() {
      const id = await getDeviceId();
      setDeviceId(id);
      setSavedProfile(await getSavedQueueProfile());
      await loadActiveBooking(id);
      await loadLocations();
    }
    init();
  }, [loadLocations, loadActiveBooking]);

  useEffect(() => {
    if (selectedLocationId) {
      loadSlots(selectedLocationId);
      const interval = setInterval(() => loadSlots(selectedLocationId), 15000);
      return () => clearInterval(interval);
    }
  }, [selectedLocationId, loadSlots]);

  const handleBook = async (data: { name: string; contact: string; partySize: number }) => {
    if (!selectedSlot || !deviceId) return;
    setBooking(true);
    try {
      const result = await bookTimeSlot(selectedSlot.id, {
        customerName: data.name,
        phoneNumber: data.contact,
        partySize: data.partySize,
        deviceId,
      });
      await setActiveTimeSlotBooking(result.id);
      setActiveBooking(result);
      setBookModalOpen(false);
      setSelectedSlot(null);
      Toast.show({ type: 'success', text1: 'Slot booked!' });
      if (selectedLocationId) await loadSlots(selectedLocationId);
      router.push(`/timeslots/confirmation/${result.id}` as Href);
    } catch (err) {
      if (err instanceof QueueApiError && err.existingBookingId) {
        Toast.show({
          type: 'info',
          text1: 'You already have a booking',
          text2: 'Opening your current slot',
        });
        router.push(`/timeslots/confirmation/${err.existingBookingId}` as Href);
        return;
      }
      Toast.show({
        type: 'error',
        text1: 'Booking failed',
        text2: err instanceof Error ? err.message : 'Please try again',
      });
    } finally {
      setBooking(false);
    }
  };

  const handleCancelBooking = () => {
    if (!activeBooking || !deviceId) return;
    Alert.alert('Cancel booking?', 'Your time slot will be released for others.', [
      { text: 'Keep Slot', style: 'cancel' },
      {
        text: 'Cancel Booking',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await cancelTimeSlotBooking(activeBooking.id, deviceId);
            await clearActiveTimeSlotBooking();
            setActiveBooking(null);
            if (selectedLocationId) await loadSlots(selectedLocationId);
            Toast.show({ type: 'info', text1: 'Booking cancelled' });
          } catch (err) {
            Toast.show({
              type: 'error',
              text1: 'Cancel failed',
              text2: err instanceof Error ? err.message : undefined,
            });
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const openBookFlow = (slot: TimeSlot) => {
    if (activeBooking) {
      Toast.show({
        type: 'info',
        text1: 'You already have a slot',
        text2: 'Cancel your current booking to book another',
      });
      return;
    }
    setSelectedSlot(slot);
    setBookModalOpen(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>TimeSlots</Text>
          <Text style={styles.subtitle}>Schedule your arrival — skip the line</Text>
        </View>
        <TouchableOpacity
          style={styles.detailsBtn}
          onPress={() => setEditProfileOpen(true)}
          accessibilityLabel="Edit my details"
        >
          <Ionicons name="person-circle-outline" size={22} color={SLOT_COLORS.text} />
          <Text style={styles.detailsBtnText}>My Details</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={SLOT_COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={slots}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={
            <>
              {activeBooking && (
                <MySlotCard
                  booking={activeBooking}
                  onView={() =>
                    router.push(`/timeslots/confirmation/${activeBooking.id}` as Href)
                  }
                  onCancel={handleCancelBooking}
                  cancelling={cancelling}
                />
              )}

              <Text style={styles.sectionLabel}>Select location</Text>
              <View style={styles.locationPicker}>
                {locations.map((loc) => (
                  <TouchableOpacity
                    key={loc.id}
                    style={[
                      styles.locChip,
                      selectedLocationId === loc.id && styles.locChipActive,
                    ]}
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

              {selectedLocation && (
                <Text style={styles.locationName}>{selectedLocation.name}</Text>
              )}

              <Text style={styles.sectionLabel}>Available slots</Text>

              {slotsLoading && (
                <ActivityIndicator
                  style={{ marginVertical: 20 }}
                  color={SLOT_COLORS.primary}
                />
              )}
            </>
          }
          renderItem={({ item }) => (
            <TimeSlotCard slot={item} onBook={() => openBookFlow(item)} booking={booking} />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadLocations();
                if (selectedLocationId) loadSlots(selectedLocationId);
                if (deviceId) loadActiveBooking(deviceId);
              }}
              tintColor={SLOT_COLORS.primary}
            />
          }
          ListEmptyComponent={
            !slotsLoading ? (
              <Text style={styles.emptyText}>No time slots available yet.</Text>
            ) : null
          }
        />
      )}

      <BookSlotModal
        visible={bookModalOpen}
        location={selectedLocation}
        slot={selectedSlot}
        savedProfile={savedProfile}
        onClose={() => {
          setBookModalOpen(false);
          setSelectedSlot(null);
        }}
        onSubmit={handleBook}
        submitting={booking}
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
        }}
      />
      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SLOT_COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  headerText: { flex: 1 },
  title: { fontSize: 28, fontWeight: '800', color: SLOT_COLORS.text },
  subtitle: { fontSize: 15, color: SLOT_COLORS.textSecondary, marginTop: 4 },
  detailsBtn: { alignItems: 'center', gap: 2, paddingTop: 4 },
  detailsBtnText: { fontSize: 11, fontWeight: '600', color: SLOT_COLORS.textSecondary },
  list: { paddingHorizontal: 20, paddingBottom: 24 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: SLOT_COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
    marginTop: 4,
  },
  locationPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  locChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: SLOT_COLORS.card,
    borderWidth: 1,
    borderColor: SLOT_COLORS.border,
  },
  locChipActive: { backgroundColor: SLOT_COLORS.primary, borderColor: SLOT_COLORS.primary },
  locChipText: { fontSize: 13, fontWeight: '700', color: SLOT_COLORS.textSecondary },
  locChipTextActive: { color: '#FFF' },
  locationName: {
    fontSize: 18,
    fontWeight: '700',
    color: SLOT_COLORS.text,
    marginBottom: 16,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: {
    textAlign: 'center',
    color: SLOT_COLORS.textMuted,
    fontSize: 15,
    paddingVertical: 32,
  },
});
