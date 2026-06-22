import { SLOT_COLORS } from '@/constants/timeSlotTheme';
import { getDeviceId } from '@/utils/notifications';
import {
  cancelTimeSlotBooking,
  fetchTimeSlotBooking,
  formatSlotDate,
  formatSlotRange,
} from '@/utils/timeSlotApi';
import { clearActiveTimeSlotBooking } from '@/utils/timeSlotSession';
import { TimeSlotBooking } from '@/utils/timeSlotTypes';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

export default function SlotConfirmationScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const id = Number(bookingId);
  const [booking, setBooking] = useState<TimeSlotBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id || Number.isNaN(id)) return;
    try {
      setBooking(await fetchTimeSlotBooking(id));
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load booking' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    refresh();
  }, [refresh]);

  const handleCancel = () => {
    Alert.alert('Cancel booking?', 'Your time slot will be released.', [
      { text: 'Keep Slot', style: 'cancel' },
      {
        text: 'Cancel Booking',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await cancelTimeSlotBooking(id, deviceId ?? undefined);
            await clearActiveTimeSlotBooking();
            Toast.show({ type: 'info', text1: 'Booking cancelled' });
            router.back();
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

  if (loading || !booking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={SLOT_COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isActive = booking.status === 'booked';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={SLOT_COLORS.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={56} color={SLOT_COLORS.success} />
        </View>
        <Text style={styles.title}>You're booked!</Text>
        <Text style={styles.subtitle}>Show this confirmation when you arrive</Text>

        <View style={styles.card}>
          <Text style={styles.businessName}>{booking.restaurantName || 'Restaurant'}</Text>

          {booking.slotStartTime && booking.slotEndTime && (
            <>
              <Text style={styles.date}>{formatSlotDate(booking.slotStartTime)}</Text>
              <Text style={styles.time}>
                {formatSlotRange(booking.slotStartTime, booking.slotEndTime)}
              </Text>
            </>
          )}

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Party size</Text>
            <Text style={styles.value}>{booking.partySize}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Confirmation code</Text>
            <Text style={styles.code}>{booking.confirmationCode}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Guest</Text>
            <Text style={styles.value}>{booking.customerName}</Text>
          </View>
        </View>

        <View style={styles.instructions}>
          <Ionicons name="information-circle-outline" size={20} color={SLOT_COLORS.info} />
          <Text style={styles.instructionText}>
            Arrive within 10 minutes of your selected time. Check in with staff using your
            confirmation code.
          </Text>
        </View>

        {isActive && (
          <Pressable
            style={[styles.cancelBtn, cancelling && styles.cancelBtnDisabled]}
            onPress={handleCancel}
            disabled={cancelling}
          >
            <Text style={styles.cancelBtnText}>
              {cancelling ? 'Cancelling...' : 'Cancel Booking'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SLOT_COLORS.background },
  content: { padding: 24, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { fontSize: 16, fontWeight: '600', color: SLOT_COLORS.text, marginLeft: 4 },
  successIcon: { alignItems: 'center', marginBottom: 12 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: SLOT_COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: SLOT_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 6,
  },
  card: {
    backgroundColor: SLOT_COLORS.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SLOT_COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  businessName: { fontSize: 22, fontWeight: '800', color: SLOT_COLORS.text },
  date: {
    fontSize: 14,
    fontWeight: '600',
    color: SLOT_COLORS.textSecondary,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  time: { fontSize: 26, fontWeight: '800', color: SLOT_COLORS.primary, marginTop: 4 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: SLOT_COLORS.border,
    marginVertical: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: { fontSize: 14, color: SLOT_COLORS.textSecondary },
  value: { fontSize: 16, fontWeight: '700', color: SLOT_COLORS.text },
  code: {
    fontSize: 16,
    fontWeight: '800',
    color: SLOT_COLORS.info,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  instructions: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    alignItems: 'flex-start',
  },
  instructionText: { flex: 1, fontSize: 14, color: SLOT_COLORS.text, lineHeight: 20 },
  cancelBtn: {
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SLOT_COLORS.danger,
  },
  cancelBtnDisabled: { opacity: 0.6 },
  cancelBtnText: { color: SLOT_COLORS.danger, fontWeight: '700', fontSize: 15 },
});
