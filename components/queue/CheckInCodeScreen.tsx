import { QUEUE_COLORS } from '@/constants/queueTheme';
import { QueueEntry } from '@/utils/queueTypes';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  entry: QueueEntry;
};

export default function CheckInCodeScreen({ entry }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.successIcon}>
        <Text style={styles.checkmark}>✓</Text>
      </View>
      <Text style={styles.title}>You're Checked In</Text>
      <Text style={styles.subtitle}>Show this code to the employee</Text>

      <View style={styles.codeBox}>
        <Text style={styles.code}>{entry.checkInCode}</Text>
      </View>

      <View style={styles.details}>
        <Text style={styles.detailText}>
          {entry.customerName} · Party of {entry.partySize}
        </Text>
        <Text style={styles.detailHint}>An employee will verify your code shortly.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  checkmark: {
    fontSize: 32,
    color: QUEUE_COLORS.success,
    fontWeight: '800',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: QUEUE_COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: QUEUE_COLORS.textSecondary,
    marginBottom: 28,
  },
  codeBox: {
    backgroundColor: QUEUE_COLORS.background,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 48,
    borderWidth: 2,
    borderColor: QUEUE_COLORS.success,
    marginBottom: 24,
  },
  code: {
    fontSize: 48,
    fontWeight: '900',
    color: QUEUE_COLORS.text,
    letterSpacing: 8,
  },
  details: {
    alignItems: 'center',
  },
  detailText: {
    fontSize: 15,
    color: QUEUE_COLORS.text,
    fontWeight: '600',
    marginBottom: 6,
  },
  detailHint: {
    fontSize: 14,
    color: QUEUE_COLORS.textMuted,
    textAlign: 'center',
  },
});
