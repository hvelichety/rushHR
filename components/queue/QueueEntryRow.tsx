import { QUEUE_STATUS_COLORS, QUEUE_STATUS_LABELS, QUEUE_COLORS } from '@/constants/queueTheme';
import { formatPhoneFromE164 } from '@/utils/phone';
import { QueueEntry } from '@/utils/queueTypes';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  entry: QueueEntry;
  onCallNext?: () => void;
  onMarkServed: () => void;
  onMarkNoShow: () => void;
  onRemove: () => void;
  isFirst?: boolean;
};

export default function QueueEntryRow({
  entry,
  onMarkServed,
  onMarkNoShow,
  onRemove,
}: Props) {
  const statusColor = QUEUE_STATUS_COLORS[entry.status] ?? QUEUE_COLORS.textSecondary;

  return (
    <View style={styles.row}>
      <View style={styles.positionCol}>
        <Text style={styles.position}>#{entry.position}</Text>
      </View>

      <View style={styles.infoCol}>
        <Text style={styles.name}>{entry.customerName}</Text>
        <Text style={styles.meta}>
          Party of {entry.partySize} · {formatPhoneFromE164(entry.customerContact)}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {QUEUE_STATUS_LABELS[entry.status] ?? entry.status}
          </Text>
        </View>
        {entry.checkInCode && (
          <Text style={styles.code}>Code: {entry.checkInCode}</Text>
        )}
      </View>

      <View style={styles.actionsCol}>
        {entry.status === 'checked_in' && (
          <Pressable style={[styles.actionBtn, styles.servedBtn]} onPress={onMarkServed}>
            <Text style={styles.actionBtnText}>Served</Text>
          </Pressable>
        )}
        {(entry.status === 'called' || entry.status === 'checked_in') && (
          <Pressable style={[styles.actionBtn, styles.noShowBtn]} onPress={onMarkNoShow}>
            <Text style={styles.actionBtnTextDark}>No Show</Text>
          </Pressable>
        )}
        <Pressable style={[styles.actionBtn, styles.removeBtn]} onPress={onRemove}>
          <Text style={styles.actionBtnTextDark}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: QUEUE_COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: QUEUE_COLORS.border,
  },
  positionCol: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  position: {
    fontSize: 18,
    fontWeight: '800',
    color: QUEUE_COLORS.textSecondary,
  },
  infoCol: {
    flex: 1,
    marginHorizontal: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: QUEUE_COLORS.text,
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    color: QUEUE_COLORS.textSecondary,
    marginBottom: 6,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  code: {
    fontSize: 14,
    fontWeight: '800',
    color: QUEUE_COLORS.success,
    marginTop: 4,
  },
  actionsCol: {
    gap: 6,
    justifyContent: 'center',
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 72,
  },
  servedBtn: {
    backgroundColor: QUEUE_COLORS.success,
  },
  noShowBtn: {
    backgroundColor: '#FEE2E2',
  },
  removeBtn: {
    backgroundColor: QUEUE_COLORS.background,
    borderWidth: 1,
    borderColor: QUEUE_COLORS.border,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnTextDark: {
    color: QUEUE_COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
});
