import { QUEUE_STATUS_COLORS, QUEUE_STATUS_LABELS, QUEUE_COLORS } from '@/constants/queueTheme';
import { QueueEntry, QueueStatus } from '@/utils/queueTypes';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  entry: QueueEntry;
};

function StatusIcon({ status }: { status: QueueStatus }) {
  switch (status) {
    case 'fifth_in_line':
      return <Ionicons name="walk-outline" size={28} color={QUEUE_COLORS.fifthInLine} />;
    case 'next_in_line':
      return <Ionicons name="alert-circle-outline" size={28} color={QUEUE_COLORS.nextInLine} />;
    case 'called':
      return <Ionicons name="megaphone-outline" size={28} color={QUEUE_COLORS.turn} />;
    case 'checked_in':
      return <Ionicons name="checkmark-circle-outline" size={28} color={QUEUE_COLORS.checkedIn} />;
    default:
      return <Ionicons name="time-outline" size={28} color={QUEUE_COLORS.textSecondary} />;
  }
}

export default function QueueStatusBadge({ entry }: Props) {
  const color = QUEUE_STATUS_COLORS[entry.status] ?? QUEUE_COLORS.textSecondary;
  const label = QUEUE_STATUS_LABELS[entry.status] ?? entry.status;

  return (
    <View style={[styles.badge, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
      <StatusIcon status={entry.status} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

export function QueueStatsPanel({ entry }: Props) {
  return (
    <View style={styles.statsPanel}>
      <View style={styles.statBox}>
        <Text style={styles.statNumber}>{entry.position}</Text>
        <Text style={styles.statCaption}>Position</Text>
      </View>
      <View style={styles.verticalDivider} />
      <View style={styles.statBox}>
        <Text style={styles.statNumber}>{entry.peopleAhead ?? 0}</Text>
        <Text style={styles.statCaption}>People Ahead</Text>
      </View>
      <View style={styles.verticalDivider} />
      <View style={styles.statBox}>
        <Text style={styles.statNumber}>{entry.estimatedWaitMinutes ?? 0}</Text>
        <Text style={styles.statCaption}>Est. Wait (min)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  statsPanel: {
    flexDirection: 'row',
    backgroundColor: QUEUE_COLORS.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: QUEUE_COLORS.border,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: QUEUE_COLORS.text,
  },
  statCaption: {
    fontSize: 13,
    color: QUEUE_COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  verticalDivider: {
    width: 1,
    backgroundColor: QUEUE_COLORS.border,
    marginHorizontal: 8,
  },
});
