import { Restaurant } from '@/utils/types';
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

const SUGGESTIONS = [
  'Wait time right now for a party of 4',
  "What's today's special?",
  'Can I order online and pay with a gift card later?',
  'Do you have vegetarian options today?',
];

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
  const [question, setQuestion] = useState('');
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : height,
      duration: visible ? 350 : 250,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  useEffect(() => {
    if (visible) setQuestion('');
  }, [visible, restaurant?.id]);

  if (!restaurant) return null;

  const trimmed = question.trim();
  const canSubmit = trimmed.length >= 3 && !submitting;

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
          <Text style={styles.title}>Ask {restaurant.name}</Text>
          <Text style={styles.subtitle}>
            Type what you want our AI to ask the restaurant on the phone.
          </Text>

          <TextInput
            style={styles.input}
            value={question}
            onChangeText={setQuestion}
            placeholder="e.g. wait time for a party of 6"
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={500}
            editable={!submitting}
          />

          <View style={styles.chips}>
            {SUGGESTIONS.map((suggestion) => (
              <Pressable
                key={suggestion}
                style={styles.chip}
                onPress={() => setQuestion(suggestion)}
                disabled={submitting}
              >
                <Text style={styles.chipText}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={() => canSubmit && onSubmit(trimmed)}
            disabled={!canSubmit}
          >
            <Text style={styles.buttonText}>
              {submitting ? 'Placing call...' : 'Call restaurant'}
            </Text>
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
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
  chipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
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
