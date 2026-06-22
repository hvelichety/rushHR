import { SLOT_COLORS } from '@/constants/timeSlotTheme';
import { QueueGuestProfile } from '@/utils/queueProfile';
import { BusinessLocation } from '@/utils/queueTypes';
import { TimeSlot } from '@/utils/timeSlotTypes';
import { formatSlotRange } from '@/utils/timeSlotApi';
import { formatPhoneFromE164 } from '@/utils/phone';
import { getPartySizeValidationMessage, parsePartySize } from '@/utils/partySize';
import {
  formatPhoneE164,
  getPhoneValidationMessage,
  isValidPhone,
} from '@/utils/phone';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const { height } = Dimensions.get('window');

type Props = {
  visible: boolean;
  location: BusinessLocation | null;
  slot: TimeSlot | null;
  savedProfile?: QueueGuestProfile | null;
  onClose: () => void;
  onSubmit: (data: { name: string; contact: string; partySize: number }) => void;
  submitting?: boolean;
};

export default function BookSlotModal({
  visible,
  location,
  slot,
  savedProfile,
  onClose,
  onSubmit,
  submitting = false,
}: Props) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [partyTouched, setPartyTouched] = useState(false);
  const slideAnim = useRef(new Animated.Value(height)).current;

  const phoneError = phoneTouched ? getPhoneValidationMessage(contact) : null;
  const phoneValid = isValidPhone(contact);
  const partyError = partyTouched ? getPartySizeValidationMessage(partySize) : null;
  const partyValid = parsePartySize(partySize) !== null;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : height,
      duration: visible ? 350 : 250,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  useEffect(() => {
    if (visible) {
      if (savedProfile) {
        setName(savedProfile.name);
        setContact(formatPhoneFromE164(savedProfile.phone));
        setPartySize(String(savedProfile.partySize));
      } else {
        setName('');
        setContact('');
        setPartySize('2');
      }
      setPhoneTouched(false);
      setPartyTouched(false);
    }
  }, [visible, savedProfile]);

  if (!location || !slot) return null;

  const canSubmit = name.trim().length > 0 && phoneValid && partyValid && !submitting;

  const handleSubmit = () => {
    setPhoneTouched(true);
    setPartyTouched(true);
    if (!phoneValid || !partyValid) return;
    const e164 = formatPhoneE164(contact);
    const size = parsePartySize(partySize);
    if (!e164 || size === null) return;
    onSubmit({ name: name.trim(), contact: e164, partySize: size });
  };

  return (
    <Modal visible={visible} transparent animationType="none">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, height],
                    outputRange: [0, height],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Book Time Slot</Text>
          <Text style={styles.subtitle}>{location.name}</Text>
          <Text style={styles.slotTime}>{formatSlotRange(slot.startTime, slot.endTime)}</Text>

          <Text style={styles.label}>Your Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Jane Doe"
            placeholderTextColor={SLOT_COLORS.textMuted}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={[styles.input, phoneError && phoneTouched && styles.inputError]}
            value={contact}
            onChangeText={setContact}
            onBlur={() => setPhoneTouched(true)}
            placeholder="(555) 123-4567"
            placeholderTextColor={SLOT_COLORS.textMuted}
            keyboardType="phone-pad"
            autoCapitalize="none"
            maxLength={16}
          />
          {phoneError && phoneTouched ? (
            <Text style={styles.errorText}>{phoneError}</Text>
          ) : (
            <Text style={styles.hintText}>US phone number — 10 digits</Text>
          )}

          <Text style={styles.label}>Party Size</Text>
          <TextInput
            style={[styles.input, partyError && partyTouched && styles.inputError]}
            value={partySize}
            onChangeText={(t) => setPartySize(t.replace(/\D/g, ''))}
            onBlur={() => setPartyTouched(true)}
            placeholder="e.g. 4"
            placeholderTextColor={SLOT_COLORS.textMuted}
            keyboardType="number-pad"
            maxLength={2}
          />
          {partyError && partyTouched ? (
            <Text style={styles.errorText}>{partyError}</Text>
          ) : null}

          <Pressable
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            disabled={!canSubmit}
            onPress={handleSubmit}
          >
            <Text style={styles.buttonText}>{submitting ? 'Booking...' : 'Confirm Booking'}</Text>
          </Pressable>

          <Pressable onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 36,
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    backgroundColor: SLOT_COLORS.borderLight,
    borderRadius: 3,
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '800', color: SLOT_COLORS.text },
  subtitle: { fontSize: 15, color: SLOT_COLORS.textSecondary, marginTop: 4 },
  slotTime: {
    fontSize: 17,
    fontWeight: '700',
    color: SLOT_COLORS.primary,
    marginBottom: 20,
    marginTop: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: SLOT_COLORS.text,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: SLOT_COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: SLOT_COLORS.text,
    borderWidth: 1,
    borderColor: SLOT_COLORS.borderLight,
    marginBottom: 4,
  },
  inputError: { borderColor: SLOT_COLORS.danger },
  errorText: { fontSize: 13, color: SLOT_COLORS.danger, marginBottom: 8, fontWeight: '500' },
  hintText: { fontSize: 13, color: SLOT_COLORS.textMuted, marginBottom: 8 },
  button: {
    backgroundColor: SLOT_COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  cancelButton: { paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: SLOT_COLORS.textSecondary, fontSize: 15, fontWeight: '600' },
});
