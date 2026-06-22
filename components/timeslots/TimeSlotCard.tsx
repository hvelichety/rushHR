import {
  SLOT_COLORS,
  SLOT_STATUS_COLORS,
  SLOT_STATUS_LABELS,
} from '@/constants/timeSlotTheme';
import { TimeSlot } from '@/utils/timeSlotTypes';
import { formatSlotDate, formatSlotRange } from '@/utils/timeSlotApi';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  slot: TimeSlot;
  onBook: () => void;
  booking?: boolean;
};

export default function TimeSlotCard({ slot, onBook, booking }: Props) {
  const isFull = slot.displayStatus === 'full';
  const statusColor = SLOT_STATUS_COLORS[slot.displayStatus];

  return (
    <View style={[styles.card, isFull && styles.cardDisabled]}>
      <View style={styles.row}>
        <View style={styles.timeBlock}>
          <Text style={styles.date}>{formatSlotDate(slot.startTime)}</Text>
          <Text style={styles.time}>{formatSlotRange(slot.startTime, slot.endTime)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${statusColor}18` }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {SLOT_STATUS_LABELS[slot.displayStatus]}
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{slot.spotsAvailable}</Text>
          <Text style={styles.statLabel}>spots left</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{slot.arrivalWindowMinutes}m</Text>
          <Text style={styles.statLabel}>arrival window</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {slot.bookedCount}/{slot.capacity}
          </Text>
          <Text style={styles.statLabel}>booked</Text>
        </View>
      </View>

      <Text style={styles.hint}>
        Arrive within {slot.arrivalWindowMinutes} minutes of your selected time.
      </Text>

      <Pressable
        style={[styles.button, isFull && styles.buttonDisabled]}
        onPress={onBook}
        disabled={isFull || booking}
      >
        <Text style={styles.buttonText}>
          {isFull ? 'Full' : booking ? 'Booking...' : 'Book Slot'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SLOT_COLORS.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SLOT_COLORS.border,
  },
  cardDisabled: {
    opacity: 0.72,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  timeBlock: {
    flex: 1,
  },
  date: {
    fontSize: 13,
    fontWeight: '600',
    color: SLOT_COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  time: {
    fontSize: 20,
    fontWeight: '800',
    color: SLOT_COLORS.text,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stats: {
    flexDirection: 'row',
    backgroundColor: SLOT_COLORS.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: SLOT_COLORS.text,
  },
  statLabel: {
    fontSize: 11,
    color: SLOT_COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: SLOT_COLORS.border,
    marginHorizontal: 4,
  },
  hint: {
    fontSize: 13,
    color: SLOT_COLORS.textMuted,
    marginBottom: 14,
  },
  button: {
    backgroundColor: SLOT_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: SLOT_COLORS.borderLight,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
