import { Restaurant } from '@/utils/types';
import { TEST_RESTAURANT_ID } from '@/utils/config';
import { formatPhoneFromE164 } from '@/utils/phone';
import { getSavedQueueProfile } from '@/utils/queueProfile';
import {
  buildPickupQuestion,
  getPickupItemsValidationMessage,
  getPickupNameValidationMessage,
  isValidPickupItems,
  isValidPickupName,
} from '@/utils/pickupOrder';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const { height } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = height * 0.92;

const SUGGESTIONS = [
  'Wait time right now for a party of 4',
  "What's today's special?",
  'Do you have vegetarian options today?',
];

const PICKUP_CHIP_LABEL = 'Order for pickup';

type Props = {
  visible: boolean;
  restaurant: Restaurant | null;
  onClose: () => void;
  onSubmit: (question: string) => void;
  submitting?: boolean;
};

export default function AskRestaurantModal({
  visible,
  restaurant,
  onClose,
  onSubmit,
  submitting = false,
}: Props) {
  const [mode, setMode] = useState<'freeform' | 'pickup'>('freeform');
  const [question, setQuestion] = useState('');
  const [pickupName, setPickupName] = useState('');
  const [pickupItems, setPickupItems] = useState('');
  const [nameFromSavedProfile, setNameFromSavedProfile] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [itemsTouched, setItemsTouched] = useState(false);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const inputRef = useRef<TextInput>(null);
  const pickupItemsRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : height,
      duration: visible ? 350 : 250,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  useEffect(() => {
    if (!visible) return;

    setMode('freeform');
    setQuestion('');
    setPickupItems('');
    setNameFromSavedProfile(false);
    setNameTouched(false);
    setItemsTouched(false);

    void (async () => {
      const profile = await getSavedQueueProfile();
      if (profile?.name) {
        setPickupName(profile.name);
        setNameFromSavedProfile(true);
      } else {
        setPickupName('');
      }
    })();
  }, [visible, restaurant?.id]);

  if (!restaurant) return null;

  const trimmed = question.trim();
  const pickupNameTrim = pickupName.trim();
  const pickupItemsTrim = pickupItems.trim();

  const nameError = nameTouched ? getPickupNameValidationMessage(pickupName) : null;
  const itemsError = itemsTouched ? getPickupItemsValidationMessage(pickupItems) : null;

  const composedPickup =
    isValidPickupName(pickupName) && isValidPickupItems(pickupItems)
      ? buildPickupQuestion(pickupNameTrim, pickupItemsTrim)
      : '';

  const canSubmitFreeform = trimmed.length >= 3 && !submitting;
  const canSubmitPickup =
    isValidPickupName(pickupName) && isValidPickupItems(pickupItems) && !submitting;

  const startPickupMode = () => {
    setMode('pickup');
    setQuestion('');
    setNameTouched(false);
    setItemsTouched(false);
    setTimeout(() => pickupItemsRef.current?.focus(), 150);
  };

  const applySuggestion = (suggestion: string) => {
    setMode('freeform');
    setQuestion(suggestion);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSubmit = () => {
    if (mode === 'pickup') {
      setNameTouched(true);
      setItemsTouched(true);
      if (!canSubmitPickup) return;
      onSubmit(composedPickup);
      return;
    }
    if (!canSubmitFreeform) return;
    onSubmit(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              maxHeight: SHEET_MAX_HEIGHT,
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
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            bounces={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.handle} />
            <Text style={styles.title}>Ask {restaurant.name}</Text>
            <Text style={styles.subtitle}>
              {restaurant.id === TEST_RESTAURANT_ID
                ? 'Test mode: we call your phone number, not a restaurant. Answer and respond as if you work there.'
                : mode === 'pickup'
                  ? 'We’ll call and place your pickup order — just fill in the details below.'
                  : 'We call the restaurant for you. Your phone won’t ring — you’ll get their answer in the app.'}
            </Text>

            {restaurant.id === TEST_RESTAURANT_ID && restaurant.phone ? (
              <View style={styles.testBanner}>
                <Text style={styles.testBannerText}>
                  Calls go to {formatPhoneFromE164(restaurant.phone)}. If your phone doesn’t ring,
                  turn off Silence Unknown Callers in Settings → Phone.
                </Text>
              </View>
            ) : null}

            {mode === 'pickup' ? (
              <View style={styles.pickupForm}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Name for pickup</Text>
                  <TextInput
                    style={[styles.fieldInput, nameError && styles.fieldInputError]}
                    value={pickupName}
                    onChangeText={(text) => {
                      setPickupName(text);
                      setNameFromSavedProfile(false);
                    }}
                    onBlur={() => setNameTouched(true)}
                    placeholder="e.g. Hansini"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="words"
                    maxLength={40}
                    editable={!submitting}
                  />
                  {nameError ? (
                    <Text style={styles.fieldError}>{nameError}</Text>
                  ) : nameFromSavedProfile ? (
                    <Text style={styles.fieldHint}>Using your saved name from queue</Text>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>What to order</Text>
                  <TextInput
                    ref={pickupItemsRef}
                    style={[
                      styles.fieldInput,
                      styles.fieldInputMultiline,
                      itemsError && styles.fieldInputError,
                    ]}
                    value={pickupItems}
                    onChangeText={setPickupItems}
                    onBlur={() => setItemsTouched(true)}
                    placeholder="e.g. 1 garlic naan, 1 paneer butter masala"
                    placeholderTextColor="#94A3B8"
                    multiline
                    maxLength={400}
                    editable={!submitting}
                  />
                  {itemsError ? <Text style={styles.fieldError}>{itemsError}</Text> : null}
                </View>

                {composedPickup ? (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewLabel}>We’ll say</Text>
                    <Text style={styles.previewText}>{composedPickup}</Text>
                  </View>
                ) : null}

                <Pressable
                  style={styles.switchModeBtn}
                  onPress={() => setMode('freeform')}
                  disabled={submitting}
                >
                  <Text style={styles.switchModeText}>Ask something else instead</Text>
                </Pressable>
              </View>
            ) : (
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={question}
                onChangeText={setQuestion}
                placeholder="e.g. wait time for a party of 6"
                placeholderTextColor="#94A3B8"
                multiline
                maxLength={500}
                editable={!submitting}
              />
            )}

            <View style={styles.chips}>
              <Pressable
                style={[styles.chip, mode === 'pickup' && styles.chipPickupActive]}
                onPress={startPickupMode}
                disabled={submitting}
              >
                <Text
                  style={[
                    styles.chipTextPickup,
                    mode === 'pickup' && styles.chipTextPickupActive,
                  ]}
                >
                  {PICKUP_CHIP_LABEL}
                </Text>
              </Pressable>
              {SUGGESTIONS.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  style={styles.chip}
                  onPress={() => applySuggestion(suggestion)}
                  disabled={submitting}
                >
                  <Text style={styles.chipText}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[
                styles.button,
                (submitting || (mode === 'freeform' && !canSubmitFreeform)) && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting || (mode === 'freeform' && !canSubmitFreeform)}
            >
              <Text style={styles.buttonText}>
                {submitting ? 'Placing call...' : 'Call restaurant'}
              </Text>
            </Pressable>

            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 14,
  },
  testBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  testBannerText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: '#0F172A',
    textAlignVertical: 'top',
    backgroundColor: '#F8FAFC',
  },
  pickupForm: {
    gap: 12,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  fieldInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  fieldInputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  fieldHint: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  fieldError: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
    lineHeight: 17,
  },
  previewBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  previewText: {
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 20,
    fontWeight: '500',
  },
  switchModeBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  switchModeText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipPickupActive: {
    backgroundColor: '#F45B5B',
    borderColor: '#F45B5B',
  },
  chipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  chipTextPickup: {
    fontSize: 12,
    color: '#BE123C',
    fontWeight: '700',
  },
  chipTextPickupActive: {
    color: '#FFFFFF',
  },
  button: {
    backgroundColor: '#F45B5B',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  cancelBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 15,
  },
});
