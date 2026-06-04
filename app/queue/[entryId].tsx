import CheckInCodeScreen from '@/components/queue/CheckInCodeScreen';
import QueueStatusBadge, { QueueStatsPanel } from '@/components/queue/QueueStatusBadge';
import TurnScreen from '@/components/queue/TurnScreen';
import { QUEUE_COLORS, QUEUE_STATUS_LABELS } from '@/constants/queueTheme';
import { useQueueNotifications } from '@/hooks/useQueueNotifications';
import {
  customerCheckIn,
  fetchQueueStatus,
  removeQueueEntry,
  requestExtension,
} from '@/utils/queueApi';
import { clearActiveQueueEntry, setActiveQueueEntry } from '@/utils/queueSession';
import { QueueEntry } from '@/utils/queueTypes';
import { getDeviceId } from '@/utils/notifications';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

export default function QueueStatusScreen() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const id = Number(entryId);
  const [entry, setEntry] = useState<QueueEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useQueueNotifications(deviceId);

  const refresh = useCallback(async () => {
    if (!id || Number.isNaN(id)) return;
    try {
      const data = await fetchQueueStatus(id);
      setEntry(data);
      setActiveQueueEntry(id);

      if (['served', 'no_show', 'removed'].includes(data.status)) {
        clearActiveQueueEntry();
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load queue status' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    getDeviceId().then(setDeviceId);
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      const updated = await customerCheckIn(id);
      setEntry(updated);
      Toast.show({ type: 'success', text1: 'Checked in!', text2: `Code: ${updated.checkInCode}` });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Check-in failed',
        text2: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveQueue = () => {
    Alert.alert(
      'Leave queue?',
      'You will lose your spot in line at this location.',
      [
        { text: 'Stay in queue', style: 'cancel' },
        {
          text: 'Leave queue',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await removeQueueEntry(id);
              clearActiveQueueEntry();
              Toast.show({ type: 'success', text1: 'You left the queue' });
              router.replace('/(tabs)/queue');
            } catch (err) {
              Toast.show({
                type: 'error',
                text1: 'Could not leave queue',
                text2: err instanceof Error ? err.message : undefined,
              });
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleExtension = async () => {
    setActionLoading(true);
    try {
      const updated = await requestExtension(id);
      setEntry(updated);
      Toast.show({ type: 'info', text1: '2 more minutes added', text2: 'Please check in when ready' });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Extension failed',
        text2: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !entry) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={QUEUE_COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isTerminal = ['served', 'no_show', 'removed'].includes(entry.status);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={QUEUE_COLORS.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.locationName}>{entry.locationName}</Text>
        <Text style={styles.customerName}>{entry.customerName} · Party of {entry.partySize}</Text>

        {entry.status === 'called' ? (
          <TurnScreen
            entry={entry}
            onCheckIn={handleCheckIn}
            onExtension={handleExtension}
            loading={actionLoading}
            onTimerExpire={refresh}
          />
        ) : entry.status === 'checked_in' ? (
          <CheckInCodeScreen entry={entry} />
        ) : isTerminal ? (
          <View style={styles.terminalBox}>
            <Text style={styles.terminalEmoji}>
              {entry.status === 'served' ? '✅' : entry.status === 'no_show' ? '⏰' : '🚫'}
            </Text>
            <Text style={styles.terminalTitle}>
              {QUEUE_STATUS_LABELS[entry.status]}
            </Text>
            <Text style={styles.terminalSubtitle}>
              {entry.status === 'served'
                ? 'Thanks for visiting!'
                : entry.status === 'no_show'
                  ? 'You were removed for not responding in time.'
                  : 'You have been removed from the queue.'}
            </Text>
            <Pressable style={styles.doneBtn} onPress={() => router.replace('/(tabs)/queue')}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <QueueStatusBadge entry={entry} />
            <QueueStatsPanel entry={entry} />
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Current Wait</Text>
              <Text style={styles.infoValue}>{entry.estimatedWaitMinutes ?? 0} minutes</Text>
              <View style={styles.infoDivider} />
              <Text style={styles.infoLabel}>People Ahead</Text>
              <Text style={styles.infoValue}>{entry.peopleAhead ?? 0}</Text>
              <View style={styles.infoDivider} />
              <Text style={styles.infoLabel}>Position</Text>
              <Text style={styles.infoValue}>#{entry.position}</Text>
            </View>
            <Text style={styles.hint}>
              We'll notify you when you're 5th in line, next in line, and when it's your turn.
            </Text>
          </>
        )}

        {!isTerminal && (
          <Pressable
            style={[styles.leaveBtn, actionLoading && styles.leaveBtnDisabled]}
            onPress={handleLeaveQueue}
            disabled={actionLoading}
          >
            <Text style={styles.leaveBtnText}>Leave Queue</Text>
          </Pressable>
        )}
      </ScrollView>
      <Toast />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QUEUE_COLORS.background,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    color: QUEUE_COLORS.text,
    fontWeight: '600',
    marginLeft: 4,
  },
  locationName: {
    fontSize: 22,
    fontWeight: '800',
    color: QUEUE_COLORS.text,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 15,
    color: QUEUE_COLORS.textSecondary,
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: QUEUE_COLORS.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: QUEUE_COLORS.border,
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    color: QUEUE_COLORS.textSecondary,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 32,
    fontWeight: '800',
    color: QUEUE_COLORS.text,
    marginBottom: 12,
  },
  infoDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: QUEUE_COLORS.border,
    marginBottom: 12,
  },
  hint: {
    fontSize: 14,
    color: QUEUE_COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  terminalBox: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  terminalEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  terminalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: QUEUE_COLORS.text,
    marginBottom: 8,
  },
  terminalSubtitle: {
    fontSize: 15,
    color: QUEUE_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  doneBtn: {
    backgroundColor: QUEUE_COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  doneBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  leaveBtn: {
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: QUEUE_COLORS.danger,
    alignItems: 'center',
  },
  leaveBtnDisabled: {
    opacity: 0.5,
  },
  leaveBtnText: {
    color: QUEUE_COLORS.danger,
    fontWeight: '700',
    fontSize: 16,
  },
});
