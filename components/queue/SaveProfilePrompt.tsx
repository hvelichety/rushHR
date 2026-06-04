import { QUEUE_COLORS } from '@/constants/queueTheme';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  onSave: () => void;
  onDecline: () => void;
};

export default function SaveProfilePrompt({ visible, onSave, onDecline }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Save your details?</Text>
          <Text style={styles.message}>
            Save your name, phone, and party size on this device so joining a queue is faster
            next time.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={onSave}>
            <Text style={styles.primaryText}>Yes, save for next time</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={onDecline}>
            <Text style={styles.secondaryText}>No thanks</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: QUEUE_COLORS.text,
    marginBottom: 10,
  },
  message: {
    fontSize: 15,
    color: QUEUE_COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: QUEUE_COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: {
    color: QUEUE_COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 15,
  },
});
