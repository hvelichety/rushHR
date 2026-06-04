import CountdownTimer from '@/components/queue/CountdownTimer';
import { QUEUE_COLORS } from '@/constants/queueTheme';
import { QueueEntry } from '@/utils/queueTypes';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  entry: QueueEntry;
  onCheckIn: () => void;
  onExtension: () => void;
  loading?: boolean;
  onTimerExpire?: () => void;
};

export default function TurnScreen({
  entry,
  onCheckIn,
  onExtension,
  loading = false,
  onTimerExpire,
}: Props) {
  const deadline = entry.extensionUsed ? entry.extensionDeadline : entry.responseDeadline;
  const timerLabel = entry.extensionUsed
    ? 'Check in before time runs out'
    : 'Respond within';

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>🔔</Text>
        <Text style={styles.heroTitle}>It's Your Turn!</Text>
        <Text style={styles.heroSubtitle}>
          Please respond so we know you're on your way to {entry.locationName ?? 'the location'}.
        </Text>
      </View>

      <CountdownTimer
        deadline={deadline}
        label={timerLabel}
        variant="urgent"
        onExpire={onTimerExpire}
      />

      <View style={styles.actions}>
        <Pressable
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onCheckIn();
          }}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.primaryButtonText}>I'm Here</Text>
          )}
        </Pressable>

        {!entry.extensionUsed && (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onExtension();
            }}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Need 2 More Minutes</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: QUEUE_COLORS.text,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: QUEUE_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: QUEUE_COLORS.success,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: QUEUE_COLORS.background,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: QUEUE_COLORS.border,
  },
  secondaryButtonText: {
    color: QUEUE_COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
