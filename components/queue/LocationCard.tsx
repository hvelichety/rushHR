import { BusinessLocation } from '@/utils/queueTypes';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { QUEUE_COLORS } from '@/constants/queueTheme';

type Props = {
  location: BusinessLocation;
  onJoin: () => void;
  onViewQueue?: () => void;
  activeEntryId?: number;
  joining?: boolean;
};

export default function LocationCard({
  location,
  onJoin,
  onViewQueue,
  activeEntryId,
  joining = false,
}: Props) {
  const isOpen = location.isQueueOpen;
  const alreadyInQueue = activeEntryId != null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.name} numberOfLines={1}>
            {location.name}
          </Text>
          {location.category && (
            <Text style={styles.category} numberOfLines={1}>
              {location.category}
            </Text>
          )}
          {location.address && (
            <Text style={styles.address} numberOfLines={1}>
              {location.address}
            </Text>
          )}
        </View>
        {!isOpen && (
          <View style={styles.pausedBadge}>
            <Text style={styles.pausedText}>Paused</Text>
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{location.currentWaitTime}</Text>
          <Text style={styles.statLabel}>min wait</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{location.queueCount}</Text>
          <Text style={styles.statLabel}>in queue</Text>
        </View>
      </View>

      <Text style={styles.waitLabel}>Current Wait: {location.currentWaitTime} minutes</Text>

      {alreadyInQueue && (
        <Text style={styles.inQueueHint}>You're already in line here</Text>
      )}

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          if (alreadyInQueue && onViewQueue) {
            onViewQueue();
          } else {
            onJoin();
          }
        }}
        disabled={!isOpen || (joining && !alreadyInQueue)}
        style={({ pressed }) => [
          styles.button,
          alreadyInQueue && styles.buttonInQueue,
          !isOpen && styles.buttonDisabled,
          pressed && isOpen && styles.buttonPressed,
        ]}
      >
        <Ionicons
          name={alreadyInQueue ? 'ticket-outline' : 'people-outline'}
          size={18}
          color="#FFFFFF"
          style={{ marginRight: 8 }}
        />
        <Text style={styles.buttonText}>
          {alreadyInQueue ? 'View My Spot' : joining ? 'Joining...' : 'Join Queue'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: QUEUE_COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: QUEUE_COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleBlock: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: QUEUE_COLORS.text,
    marginBottom: 4,
  },
  category: {
    fontSize: 14,
    color: QUEUE_COLORS.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  address: {
    fontSize: 13,
    color: QUEUE_COLORS.textSecondary,
  },
  pausedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pausedText: {
    fontSize: 12,
    fontWeight: '700',
    color: QUEUE_COLORS.warning,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: QUEUE_COLORS.background,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: QUEUE_COLORS.text,
  },
  statLabel: {
    fontSize: 13,
    color: QUEUE_COLORS.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: QUEUE_COLORS.border,
  },
  waitLabel: {
    fontSize: 14,
    color: QUEUE_COLORS.textSecondary,
    marginBottom: 14,
    fontWeight: '500',
  },
  inQueueHint: {
    fontSize: 13,
    color: QUEUE_COLORS.success,
    fontWeight: '600',
    marginBottom: 10,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: QUEUE_COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInQueue: {
    backgroundColor: QUEUE_COLORS.success,
  },
  buttonDisabled: {
    backgroundColor: QUEUE_COLORS.borderLight,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
