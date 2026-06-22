import { SLOT_COLORS } from '@/constants/timeSlotTheme';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { startTime: string; endTime: string; capacity: number }) => void;
  submitting?: boolean;
};

function buildIsoFromTime(time: string, dayOffset = 0): string {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

export default function CreateSlotModal({ visible, onClose, onSubmit, submitting }: Props) {
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('17:30');
  const [capacity, setCapacity] = useState('10');
  const [dayOffset, setDayOffset] = useState('0');

  const handleSubmit = () => {
    const cap = Number(capacity);
    const offset = Number(dayOffset);
    if (!Number.isFinite(cap) || cap <= 0) return;
    onSubmit({
      startTime: buildIsoFromTime(startTime, offset),
      endTime: buildIsoFromTime(endTime, offset),
      capacity: cap,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Create Time Slot</Text>

          <Text style={styles.label}>Day</Text>
          <View style={styles.chips}>
            {[
              { label: 'Today', value: '0' },
              { label: 'Tomorrow', value: '1' },
            ].map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.chip, dayOffset === opt.value && styles.chipActive]}
                onPress={() => setDayOffset(opt.value)}
              >
                <Text style={[styles.chipText, dayOffset === opt.value && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Start (HH:MM, 24h)</Text>
          <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} />

          <Text style={styles.label}>End (HH:MM, 24h)</Text>
          <TextInput style={styles.input} value={endTime} onChangeText={setEndTime} />

          <Text style={styles.label}>Capacity</Text>
          <TextInput
            style={styles.input}
            value={capacity}
            onChangeText={(t) => setCapacity(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
          />

          <Pressable
            style={[styles.button, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.buttonText}>{submitting ? 'Creating...' : 'Create Slot'}</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 24 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
  },
  title: { fontSize: 20, fontWeight: '800', color: SLOT_COLORS.text, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: SLOT_COLORS.text, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: SLOT_COLORS.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: SLOT_COLORS.borderLight,
  },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SLOT_COLORS.border,
  },
  chipActive: { backgroundColor: SLOT_COLORS.primary, borderColor: SLOT_COLORS.primary },
  chipText: { fontWeight: '600', color: SLOT_COLORS.textSecondary },
  chipTextActive: { color: '#FFF' },
  button: {
    backgroundColor: SLOT_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#FFF', fontWeight: '700' },
  cancel: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: SLOT_COLORS.textSecondary, fontWeight: '600' },
});
