import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { QUEUE_COLORS } from '@/constants/queueTheme';

type Props = {
  deadline: string | null | undefined;
  label?: string;
  onExpire?: () => void;
  variant?: 'default' | 'urgent';
};

export default function CountdownTimer({
  deadline,
  label,
  onExpire,
  variant = 'default',
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!deadline) {
      setSecondsLeft(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) onExpire?.();
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [deadline, onExpire]);

  if (!deadline) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const display = `${mins}:${secs.toString().padStart(2, '0')}`;

  return (
    <View style={[styles.container, variant === 'urgent' && styles.urgent]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Text style={[styles.timer, variant === 'urgent' && styles.timerUrgent]}>{display}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  urgent: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  label: {
    fontSize: 14,
    color: QUEUE_COLORS.textSecondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  timer: {
    fontSize: 36,
    fontWeight: '800',
    color: QUEUE_COLORS.warning,
    fontVariant: ['tabular-nums'],
  },
  timerUrgent: {
    color: QUEUE_COLORS.danger,
  },
});
