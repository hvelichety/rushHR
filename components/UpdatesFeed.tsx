import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CallUpdate, formatUpdateTime } from '@/utils/callUpdates';

type Props = {
  updates: CallUpdate[];
  loading?: boolean;
  onSelectUpdate: (update: CallUpdate) => void;
};

function statusMeta(status: CallUpdate['status']) {
  switch (status) {
    case 'ready':
      return {
        label: 'Ready',
        icon: '✓',
        accent: '#10B981',
        bg: '#ECFDF5',
        border: '#A7F3D0',
      };
    case 'failed':
      return {
        label: 'Issue',
        icon: '!',
        accent: '#EF4444',
        bg: '#FEF2F2',
        border: '#FECACA',
      };
    default:
      return {
        label: 'Calling',
        icon: '…',
        accent: '#F45B5B',
        bg: '#FFF1F2',
        border: '#FECDD3',
      };
  }
}

function UpdateCard({
  update,
  onPress,
}: {
  update: CallUpdate;
  onPress: () => void;
}) {
  const meta = statusMeta(update.status);
  const timeLabel = formatUpdateTime(update.completedAt ?? update.createdAt);
  const preview =
    update.status === 'ready'
      ? update.answerSummary
      : update.status === 'failed'
        ? update.errorMessage
        : 'Our AI is on the phone now';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderColor: meta.border, backgroundColor: meta.bg },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: meta.accent }]} />

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={styles.titleRow}>
            {update.isUnread ? <View style={styles.unreadDot} /> : null}
            <Text style={styles.restaurantName} numberOfLines={1}>
              {update.restaurantName}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: meta.accent }]}>
            {update.status === 'calling' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.badgeText}>{meta.icon}</Text>
            )}
          </View>
        </View>

        <Text style={styles.question} numberOfLines={2}>
          “{update.question}”
        </Text>

        {preview ? (
          <Text style={styles.preview} numberOfLines={2}>
            {update.status === 'ready' ? 'They said: ' : ''}
            {preview}
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={[styles.statusLabel, { color: meta.accent }]}>{meta.label}</Text>
          <Text style={styles.timeLabel}>{timeLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function UpdatesFeed({ updates, loading, onSelectUpdate }: Props) {
  const visible = updates.slice(0, 8);
  const unread = updates.filter((u) => u.isUnread).length;
  const calling = updates.filter((u) => u.status === 'calling').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>📬</Text>
          <View>
            <Text style={styles.headerTitle}>Your updates</Text>
            <Text style={styles.headerSubtitle}>
              {calling > 0
                ? `${calling} call${calling === 1 ? '' : 's'} in progress`
                : unread > 0
                  ? `${unread} new update${unread === 1 ? '' : 's'}`
                  : 'Answers from restaurants you called'}
            </Text>
          </View>
        </View>
        {loading ? <ActivityIndicator size="small" color="#F45B5B" /> : null}
      </View>

      {visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No updates yet</Text>
          <Text style={styles.emptyText}>
            Tap “Call & Ask” on any restaurant — your question and their answer will show up here.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {visible.map((update) => (
            <UpdateCard
              key={update.callId}
              update={update}
              onPress={() => onSelectUpdate(update)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIcon: {
    fontSize: 22,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 1,
  },
  scrollContent: {
    gap: 12,
    paddingRight: 4,
  },
  card: {
    width: 280,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  accentBar: {
    width: 4,
  },
  cardBody: {
    flex: 1,
    padding: 12,
    gap: 6,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F45B5B',
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  question: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  preview: {
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 20,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timeLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  empty: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
  },
});
