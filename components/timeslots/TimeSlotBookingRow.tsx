import {
  BOOKING_STATUS_COLORS,
  BOOKING_STATUS_LABELS,
  SLOT_COLORS,
} from '@/constants/timeSlotTheme';
import { TimeSlotBooking } from '@/utils/timeSlotTypes';
import { Pressable, StyleSheet, Text, View, Platform } from 'react-native';

type Props = {
  booking: TimeSlotBooking;
  onMarkArrived: () => void;
  onMarkNoShow: () => void;
};

export default function TimeSlotBookingRow({ booking, onMarkArrived, onMarkNoShow }: Props) {
  const statusColor = BOOKING_STATUS_COLORS[booking.status];
  const isActive = booking.status === 'booked';

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name}>{booking.customerName}</Text>
        <Text style={styles.meta}>
          Party of {booking.partySize} · {booking.phoneNumber}
        </Text>
        <Text style={styles.code}>{booking.confirmationCode}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: `${statusColor}18` }]}>
        <Text style={[styles.badgeText, { color: statusColor }]}>
          {BOOKING_STATUS_LABELS[booking.status]}
        </Text>
      </View>
      {isActive && (
        <View style={styles.actions}>
          <Pressable style={styles.arrivedBtn} onPress={onMarkArrived}>
            <Text style={styles.arrivedText}>Arrived</Text>
          </Pressable>
          <Pressable style={styles.noShowBtn} onPress={onMarkNoShow}>
            <Text style={styles.noShowText}>No Show</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: SLOT_COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SLOT_COLORS.border,
  },
  info: { marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '700', color: SLOT_COLORS.text },
  meta: { fontSize: 13, color: SLOT_COLORS.textSecondary, marginTop: 2 },
  code: {
    fontSize: 13,
    fontWeight: '700',
    color: SLOT_COLORS.info,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8 },
  arrivedBtn: {
    flex: 1,
    backgroundColor: SLOT_COLORS.success,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  arrivedText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  noShowBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SLOT_COLORS.border,
  },
  noShowText: { color: SLOT_COLORS.danger, fontWeight: '700', fontSize: 13 },
});
