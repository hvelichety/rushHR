import { QUEUE_COLORS } from '@/constants/queueTheme';
import { QueueEntry } from '@/utils/queueTypes';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  code: string;
  onCodeChange: (code: string) => void;
  onVerify: () => void;
  verifying?: boolean;
  result?: { verified: boolean; entry: QueueEntry | null } | null;
};

export default function CodeSearchPanel({
  code,
  onCodeChange,
  onVerify,
  verifying = false,
  result,
}: Props) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Verify Check-In Code</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={(t) => onCodeChange(t.toUpperCase())}
          placeholder="A492"
          placeholderTextColor={QUEUE_COLORS.textMuted}
          autoCapitalize="characters"
          maxLength={4}
        />
        <Pressable
          style={[styles.verifyBtn, verifying && styles.verifyBtnDisabled]}
          onPress={onVerify}
          disabled={verifying || code.length < 4}
        >
          <Text style={styles.verifyBtnText}>{verifying ? '...' : 'Verify'}</Text>
        </Pressable>
      </View>

      {result && (
        <View style={[styles.result, result.verified ? styles.resultSuccess : styles.resultFail]}>
          {result.verified && result.entry ? (
            <>
              <Text style={styles.resultTitle}>Verified ✓</Text>
              <Text style={styles.resultText}>
                {result.entry.customerName} · Party of {result.entry.partySize}
              </Text>
            </>
          ) : (
            <Text style={styles.resultFailText}>Code not found or already served</Text>
          )}
        </View>
      )}
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
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: QUEUE_COLORS.text,
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: QUEUE_COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 4,
    textAlign: 'center',
    color: QUEUE_COLORS.text,
    borderWidth: 1,
    borderColor: QUEUE_COLORS.borderLight,
  },
  verifyBtn: {
    backgroundColor: QUEUE_COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  verifyBtnDisabled: {
    opacity: 0.5,
  },
  verifyBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  result: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
  },
  resultSuccess: {
    backgroundColor: '#D1FAE5',
  },
  resultFail: {
    backgroundColor: '#FEE2E2',
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: QUEUE_COLORS.success,
    marginBottom: 4,
  },
  resultText: {
    fontSize: 14,
    color: QUEUE_COLORS.text,
  },
  resultFailText: {
    fontSize: 14,
    color: QUEUE_COLORS.danger,
    fontWeight: '600',
  },
});
