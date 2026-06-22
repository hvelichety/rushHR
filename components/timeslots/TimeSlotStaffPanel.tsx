import CreateSlotModal from '@/components/timeslots/CreateSlotModal';
import TimeSlotBookingRow from '@/components/timeslots/TimeSlotBookingRow';
import { SLOT_COLORS } from '@/constants/timeSlotTheme';
import {
  closeTimeSlot,
  createTimeSlot,
  fetchSlotBookings,
  fetchTimeSlots,
  formatSlotRange,
  markSlotBookingArrived,
  markSlotBookingNoShow,
  updateTimeSlotCapacity,
} from '@/utils/timeSlotApi';
import { TimeSlot, TimeSlotBooking } from '@/utils/timeSlotTypes';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

type Props = {
  locationId: number;
  locationName: string;
};

export default function TimeSlotStaffPanel({ locationId, locationName }: Props) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [bookings, setBookings] = useState<TimeSlotBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [capacityEdit, setCapacityEdit] = useState('');

  const loadSlots = useCallback(async () => {
    try {
      const data = await fetchTimeSlots(locationId);
      setSlots(data);
      if (data.length > 0 && !selectedSlotId) {
        setSelectedSlotId(data[0].id);
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Could not load slots',
        text2: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [locationId, selectedSlotId]);

  const loadBookings = useCallback(async (slotId: number) => {
    try {
      setBookings(await fetchSlotBookings(slotId));
    } catch {
      setBookings([]);
    }
  }, []);

  useEffect(() => {
    loadSlots();
    const interval = setInterval(loadSlots, 8000);
    return () => clearInterval(interval);
  }, [loadSlots]);

  useEffect(() => {
    if (selectedSlotId) {
      loadBookings(selectedSlotId);
      const slot = slots.find((s) => s.id === selectedSlotId);
      if (slot) setCapacityEdit(String(slot.capacity));
    }
  }, [selectedSlotId, slots, loadBookings]);

  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  const handleCreate = async (data: { startTime: string; endTime: string; capacity: number }) => {
    setCreating(true);
    try {
      await createTimeSlot({ restaurantId: locationId, ...data });
      setCreateOpen(false);
      Toast.show({ type: 'success', text1: 'Time slot created' });
      await loadSlots();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Create failed',
        text2: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateCapacity = async () => {
    if (!selectedSlotId) return;
    const cap = Number(capacityEdit);
    if (!Number.isFinite(cap) || cap <= 0) {
      Toast.show({ type: 'error', text1: 'Enter valid capacity' });
      return;
    }
    try {
      await updateTimeSlotCapacity(selectedSlotId, cap);
      Toast.show({ type: 'success', text1: 'Capacity updated' });
      await loadSlots();
    } catch (err) {
      Toast.show({ type: 'error', text1: err instanceof Error ? err.message : 'Failed' });
    }
  };

  const handleCloseSlot = async () => {
    if (!selectedSlotId) return;
    try {
      await closeTimeSlot(selectedSlotId);
      Toast.show({ type: 'info', text1: 'Slot closed' });
      await loadSlots();
    } catch (err) {
      Toast.show({ type: 'error', text1: err instanceof Error ? err.message : 'Failed' });
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={SLOT_COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>TimeSlots · {locationName.split(' ')[0]}</Text>
        <Pressable style={styles.addBtn} onPress={() => setCreateOpen(true)}>
          <Ionicons name="add" size={18} color="#FFF" />
          <Text style={styles.addBtnText}>New Slot</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.slotPicker}>
        {slots.map((slot) => (
          <Pressable
            key={slot.id}
            style={[styles.slotChip, selectedSlotId === slot.id && styles.slotChipActive]}
            onPress={() => setSelectedSlotId(slot.id)}
          >
            <Text
              style={[
                styles.slotChipText,
                selectedSlotId === slot.id && styles.slotChipTextActive,
              ]}
            >
              {formatSlotRange(slot.startTime, slot.endTime)}
            </Text>
            <Text
              style={[
                styles.slotChipMeta,
                selectedSlotId === slot.id && styles.slotChipTextActive,
              ]}
            >
              {slot.bookedCount}/{slot.capacity}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {selectedSlot && (
        <View style={styles.controls}>
          <Text style={styles.controlLabel}>Capacity</Text>
          <View style={styles.capacityRow}>
            <TextInput
              style={styles.capacityInput}
              value={capacityEdit}
              onChangeText={(t) => setCapacityEdit(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
            />
            <Pressable style={styles.smallBtn} onPress={handleUpdateCapacity}>
              <Text style={styles.smallBtnText}>Update</Text>
            </Pressable>
            <Pressable style={styles.closeBtn} onPress={handleCloseSlot}>
              <Text style={styles.closeBtnText}>Close Slot</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Text style={styles.bookingsTitle}>Booked Customers ({bookings.length})</Text>
      {bookings.length === 0 ? (
        <Text style={styles.empty}>No bookings for this slot</Text>
      ) : (
        bookings.map((booking) => (
          <TimeSlotBookingRow
            key={booking.id}
            booking={booking}
            onMarkArrived={async () => {
              await markSlotBookingArrived(booking.id);
              Toast.show({ type: 'success', text1: 'Marked arrived' });
              if (selectedSlotId) await loadBookings(selectedSlotId);
              await loadSlots();
            }}
            onMarkNoShow={async () => {
              await markSlotBookingNoShow(booking.id);
              Toast.show({ type: 'info', text1: 'Marked no-show' });
              if (selectedSlotId) await loadBookings(selectedSlotId);
              await loadSlots();
            }}
          />
        ))
      )}

      <CreateSlotModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        submitting={creating}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 24 },
  centered: { paddingVertical: 40, alignItems: 'center' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: SLOT_COLORS.text },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SLOT_COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  slotPicker: { marginBottom: 16 },
  slotChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: SLOT_COLORS.card,
    borderWidth: 1,
    borderColor: SLOT_COLORS.border,
    marginRight: 8,
  },
  slotChipActive: {
    backgroundColor: SLOT_COLORS.primary,
    borderColor: SLOT_COLORS.primary,
  },
  slotChipText: { fontWeight: '700', color: SLOT_COLORS.text, fontSize: 14 },
  slotChipMeta: { fontSize: 12, color: SLOT_COLORS.textSecondary, marginTop: 2 },
  slotChipTextActive: { color: '#FFF' },
  controls: {
    backgroundColor: SLOT_COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SLOT_COLORS.border,
  },
  controlLabel: { fontSize: 13, fontWeight: '600', color: SLOT_COLORS.textSecondary, marginBottom: 8 },
  capacityRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  capacityInput: {
    flex: 1,
    backgroundColor: SLOT_COLORS.background,
    borderRadius: 10,
    padding: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: SLOT_COLORS.borderLight,
  },
  smallBtn: {
    backgroundColor: SLOT_COLORS.info,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  smallBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLOT_COLORS.danger,
  },
  closeBtnText: { color: SLOT_COLORS.danger, fontWeight: '700', fontSize: 13 },
  bookingsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: SLOT_COLORS.text,
    marginBottom: 10,
  },
  empty: { color: SLOT_COLORS.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 16 },
});
