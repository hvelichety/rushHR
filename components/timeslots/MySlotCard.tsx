import {
  BOOKING_STATUS_COLORS,
  BOOKING_STATUS_LABELS,
  SLOT_COLORS,
} from '@/constants/timeSlotTheme';
import { TimeSlotBooking } from '@/utils/timeSlotTypes';
import { formatSlotDate, formatSlotRange } from '@/utils/timeSlotApi';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  booking: TimeSlotBooking;
  onView: () => void;
  onCancel?: () => void;
  cancelling?: boolean;
};

export default function MySlotCard({ booking, onView, onCancel, cancelling }: Props) {
  const statusColor = BOOKING_STATUS_COLORS[booking.status];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="calendar" size={20} color={SLOT_COLORS.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.label}>My Slot</Text>
          <Text style={styles.name} numberOfLines={1}>
            {booking.restaurantName || 'Restaurant'}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${statusColor}20` }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {BOOKING_STATUS_LABELS[booking.status]}
          </Text>
        </View>
      </View>

      {booking.slotStartTime && booking.slotEndTime && (
        <View style={styles.details}>
          <Text style={styles.time}>
            {formatSlotDate(booking.slotStartTime)} ·{' '}
            {formatSlotRange(booking.slotStartTime, booking.slotEndTime)}
          </Text>
          <Text style={styles.meta}>
            Party of {booking.partySize} · Code {booking.confirmationCode}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={styles.primaryBtn} onPress={onView}>
          <Text style={styles.primaryBtnText}>View Confirmation</Text>
        </Pressable>
        {booking.status === 'booked' && onCancel && (
          <Pressable style={styles.cancelBtn} onPress={onCancel} disabled={cancelling}>
            <Text style={styles.cancelBtnText}>{cancelling ? 'Cancelling...' : 'Cancel'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SLOT_COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SLOT_COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: SLOT_COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: SLOT_COLORS.text,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  details: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SLOT_COLORS.border,
  },
  time: {
    fontSize: 16,
    fontWeight: '700',
    color: SLOT_COLORS.text,
  },
  meta: {
    fontSize: 14,
    color: SLOT_COLORS.textSecondary,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: SLOT_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SLOT_COLORS.border,
  },
  cancelBtnText: {
    color: SLOT_COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
});
