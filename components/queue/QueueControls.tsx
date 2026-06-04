import { QUEUE_COLORS } from '@/constants/queueTheme';
import { BusinessLocation } from '@/utils/queueTypes';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  location: BusinessLocation;
  serviceTime: string;
  onServiceTimeChange: (value: string) => void;
  onUpdateServiceTime: () => void;
  onPause: () => void;
  onResume: () => void;
  onCallNext: () => void;
  callingNext?: boolean;
  updatingSettings?: boolean;
};

export default function QueueControls({
  location,
  serviceTime,
  onServiceTimeChange,
  onUpdateServiceTime,
  onPause,
  onResume,
  onCallNext,
  callingNext = false,
  updatingSettings = false,
}: Props) {
  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.locationName}>{location.name}</Text>
          <Text style={styles.queueMeta}>
            {location.queueCount} in queue · {location.currentWaitTime} min est. wait
          </Text>
        </View>
        <View style={[styles.statusDot, location.isQueueOpen ? styles.open : styles.paused]} />
      </View>

      <Pressable
        style={[styles.callNextBtn, callingNext && styles.btnDisabled]}
        onPress={onCallNext}
        disabled={callingNext || !location.isQueueOpen}
      >
        <Text style={styles.callNextText}>
          {callingNext ? 'Calling...' : 'Call Next Customer'}
        </Text>
      </Pressable>

      <View style={styles.controlsRow}>
        {location.isQueueOpen ? (
          <Pressable style={styles.pauseBtn} onPress={onPause} disabled={updatingSettings}>
            <Text style={styles.pauseBtnText}>Pause Queue</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.resumeBtn} onPress={onResume} disabled={updatingSettings}>
            <Text style={styles.resumeBtnText}>Resume Queue</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.serviceTimeRow}>
        <Text style={styles.serviceLabel}>Avg. Service Time (min)</Text>
        <View style={styles.serviceInputRow}>
          <TextInput
            style={styles.serviceInput}
            value={serviceTime}
            onChangeText={onServiceTimeChange}
            keyboardType="numeric"
            maxLength={3}
          />
          <Pressable
            style={[styles.updateBtn, updatingSettings && styles.btnDisabled]}
            onPress={onUpdateServiceTime}
            disabled={updatingSettings}
          >
            <Text style={styles.updateBtnText}>Update</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: QUEUE_COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: QUEUE_COLORS.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  locationName: {
    fontSize: 18,
    fontWeight: '800',
    color: QUEUE_COLORS.text,
  },
  queueMeta: {
    fontSize: 13,
    color: QUEUE_COLORS.textSecondary,
    marginTop: 4,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 6,
  },
  open: {
    backgroundColor: QUEUE_COLORS.success,
  },
  paused: {
    backgroundColor: QUEUE_COLORS.warning,
  },
  callNextBtn: {
    backgroundColor: QUEUE_COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  callNextText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
  },
  controlsRow: {
    marginBottom: 16,
  },
  pauseBtn: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pauseBtnText: {
    color: QUEUE_COLORS.warning,
    fontWeight: '700',
    fontSize: 15,
  },
  resumeBtn: {
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  resumeBtnText: {
    color: QUEUE_COLORS.success,
    fontWeight: '700',
    fontSize: 15,
  },
  serviceTimeRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: QUEUE_COLORS.border,
    paddingTop: 14,
  },
  serviceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: QUEUE_COLORS.text,
    marginBottom: 8,
  },
  serviceInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  serviceInput: {
    width: 80,
    backgroundColor: QUEUE_COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: QUEUE_COLORS.borderLight,
  },
  updateBtn: {
    backgroundColor: QUEUE_COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: QUEUE_COLORS.border,
  },
  updateBtnText: {
    fontWeight: '700',
    color: QUEUE_COLORS.text,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
