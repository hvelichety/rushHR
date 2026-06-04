import { QUEUE_COLORS } from '@/constants/queueTheme';
import { QueueGuestProfile } from '@/utils/queueProfile';
import { formatPhoneFromE164 } from '@/utils/phone';
import { getPartySizeValidationMessage, parsePartySize } from '@/utils/partySize';
import {
  formatPhoneE164,
  getPhoneValidationMessage,
  isValidPhone,
} from '@/utils/phone';
import { useEffect, useState } from 'react';
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
  profile: QueueGuestProfile | null;
  onClose: () => void;
  onSave: (profile: QueueGuestProfile) => void;
  onClear: () => void;
};

export default function EditQueueProfileModal({
  visible,
  profile,
  onClose,
  onSave,
  onClear,
}: Props) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [partyTouched, setPartyTouched] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (profile) {
      setName(profile.name);
      setContact(formatPhoneFromE164(profile.phone));
      setPartySize(String(profile.partySize));
    } else {
      setName('');
      setContact('');
      setPartySize('2');
    }
    setPhoneTouched(false);
    setPartyTouched(false);
  }, [visible, profile]);

  const phoneError = phoneTouched ? getPhoneValidationMessage(contact) : null;
  const phoneValid = isValidPhone(contact);
  const partyError = partyTouched ? getPartySizeValidationMessage(partySize) : null;
  const partyValid = parsePartySize(partySize) !== null;
  const canSave = name.trim().length > 0 && phoneValid && partyValid;

  const handleSave = () => {
    setPhoneTouched(true);
    setPartyTouched(true);
    const e164 = formatPhoneE164(contact);
    const size = parsePartySize(partySize);
    if (!e164 || size === null || !canSave) return;
    onSave({
      name: name.trim(),
      phone: e164,
      partySize: size,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>My Queue Details</Text>
          <Text style={styles.subtitle}>
            Saved on this device for faster join. No account required.
          </Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={QUEUE_COLORS.textMuted}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={[styles.input, phoneError && phoneTouched && styles.inputError]}
            value={contact}
            onChangeText={setContact}
            onBlur={() => setPhoneTouched(true)}
            placeholder="(555) 123-4567"
            placeholderTextColor={QUEUE_COLORS.textMuted}
            keyboardType="phone-pad"
            maxLength={16}
          />
          {phoneError && phoneTouched ? (
            <Text style={styles.errorText}>{phoneError}</Text>
          ) : null}

          <Text style={styles.label}>Default Party Size</Text>
          <TextInput
            style={[styles.input, partyError && partyTouched && styles.inputError]}
            value={partySize}
            onChangeText={(t) => setPartySize(t.replace(/\D/g, ''))}
            onBlur={() => setPartyTouched(true)}
            placeholder="e.g. 8"
            placeholderTextColor={QUEUE_COLORS.textMuted}
            keyboardType="number-pad"
            maxLength={2}
          />
          {partyError && partyTouched ? (
            <Text style={styles.errorText}>{partyError}</Text>
          ) : null}

          <Pressable
            style={[styles.saveBtn, !canSave && styles.btnDisabled]}
            disabled={!canSave}
            onPress={handleSave}
          >
            <Text style={styles.saveBtnText}>Save Changes</Text>
          </Pressable>

          {profile && (
            <Pressable style={styles.clearBtn} onPress={onClear}>
              <Text style={styles.clearBtnText}>Remove saved details</Text>
            </Pressable>
          )}

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Close</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  sheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: QUEUE_COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: QUEUE_COLORS.textSecondary,
    marginTop: 4,
    marginBottom: 20,
    lineHeight: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: QUEUE_COLORS.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: QUEUE_COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: QUEUE_COLORS.borderLight,
    marginBottom: 8,
  },
  inputError: {
    borderColor: QUEUE_COLORS.danger,
  },
  errorText: {
    fontSize: 13,
    color: QUEUE_COLORS.danger,
    marginBottom: 8,
  },
  saveBtn: {
    backgroundColor: QUEUE_COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  clearBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  clearBtnText: {
    color: QUEUE_COLORS.danger,
    fontWeight: '600',
    fontSize: 15,
  },
  cancelBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelText: {
    color: QUEUE_COLORS.textSecondary,
    fontWeight: '600',
  },
});
