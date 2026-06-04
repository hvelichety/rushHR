export const QUEUE_COLORS = {
  primary: '#F45B5B',
  primaryDark: '#E04545',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E5E7EB',
  borderLight: '#E2E8F0',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  fifthInLine: '#8B5CF6',
  nextInLine: '#F59E0B',
  turn: '#F45B5B',
  checkedIn: '#10B981',
};

export const QUEUE_STATUS_LABELS: Record<string, string> = {
  waiting: 'Waiting',
  fifth_in_line: '5th in Line',
  next_in_line: 'Next in Line',
  called: 'Your Turn',
  checked_in: 'Checked In',
  served: 'Served',
  no_show: 'No Show',
  removed: 'Removed',
};

export const QUEUE_STATUS_COLORS: Record<string, string> = {
  waiting: QUEUE_COLORS.textSecondary,
  fifth_in_line: QUEUE_COLORS.fifthInLine,
  next_in_line: QUEUE_COLORS.nextInLine,
  called: QUEUE_COLORS.turn,
  checked_in: QUEUE_COLORS.checkedIn,
  served: QUEUE_COLORS.success,
  no_show: QUEUE_COLORS.danger,
  removed: QUEUE_COLORS.textMuted,
};
