import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../services/supabase';
import { DailyLogWithAnalysis } from '../types/workowork';
import { averageScorePercent, formatPercent } from '../utils/scores';
import { useEntranceMotion } from '../utils/useEntranceMotion';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

type GrowthActivity = {
  id: string;
  title: string;
  shortDescription: string;
  duration?: string;
  motive?: string;
  objective?: string;
  task?: {
    whatToDo?: string;
    howToDo?: string;
    suggestedStarter?: string;
  };
};

type GrowthCategory = {
  id: string;
  title: string;
  description?: string;
  activities: GrowthActivity[];
};

const activityData = require('../../assets/data/activities.json') as { categories: GrowthCategory[] };

const INK = '#111110';
const INK_SOFT = '#3A3A38';
const MUTED = '#8A8A82';
const BORDER = '#E4E4DC';
const SURFACE = '#F7F7F3';
const YELLOW = '#E8D870';
const WHITE = '#FAFAF6';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MONTH_CARD_WIDTH = SCREEN_WIDTH - 48;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function localDateKey(dateInput: Date | string) {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatCalendarDate(dateKey: string) {
  return parseLocalDateKey(dateKey).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getMonthMatrix(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const matrix: (Date | null)[][] = [];
  let week: (Date | null)[] = [];

  for (let i = 0; i < first.getDay(); i++) week.push(null);
  for (let d = 1; d <= last.getDate(); d++) {
    week.push(new Date(year, month, d));
    if (week.length === 7) {
      matrix.push(week);
      week = [];
    }
  }
  if (week.length) {
    while (week.length < 7) week.push(null);
    matrix.push(week);
  }
  return matrix;
}

export default function HomeScreen({ navigation }: Props) {
  const { profile, session } = useAuth();
  const pageMotion = useEntranceMotion();
  const [logs, setLogs] = useState<DailyLogWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<(GrowthActivity & { category: string }) | null>(null);
  const [activeActivity, setActiveActivity] = useState<(GrowthActivity & { category: string }) | null>(null);
  const [completedTitle, setCompletedTitle] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    if (!session?.user.id) return;

    const { data, error } = await supabase
      .from('daily_logs')
      .select('*, ai_analysis(*)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) console.log('Log load failed', error.message);
    setLogs(error ? [] : ((data ?? []) as DailyLogWithAnalysis[]));
    setLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [loadLogs])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  const handleAddLogForDate = () => {
    if (!selectedDate) return;
    navigation.navigate('AddLog', { selectedDate });
  };

  const countsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of logs) {
      const key = localDateKey(log.created_at);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [logs]);

  const selectedDateCount = selectedDate ? countsByDate.get(selectedDate) ?? 0 : 0;
  const maxCount = useMemo(() => Math.max(1, ...Array.from(countsByDate.values(), (value) => value || 0)), [countsByDate]);
  const weeklyLogs = logs.slice(0, 7);
  const weeklyProductivityPercent = averageScorePercent(weeklyLogs.map((log) => log.productivity));

  const months = useMemo(() => {
    const out: { year: number; month: number; label: string }[] = [];
    const today = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      out.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleString(undefined, { month: 'long', year: 'numeric' }),
      });
    }
    return out;
  }, []);

  const categories = useMemo(() => activityData.categories.slice(0, 8), []);

  const openRandomActivity = (category: GrowthCategory) => {
    if (!category.activities.length) return;
    const index = Math.floor(Math.random() * category.activities.length);
    setSelectedActivity({ ...category.activities[index], category: category.title });
    setCompletedTitle(null);
  };

  const handleStartActivity = () => {
    if (!selectedActivity) return;
    setActiveActivity(selectedActivity);
    setSelectedActivity(null);
  };

  const handleCompleteActivity = async () => {
    if (!activeActivity) return;
    const title = activeActivity.title;
    setCompletedTitle(title);

    if (session?.user.id) {
      await supabase.from('growth_activity_logs').insert({
        user_id: session.user.id,
        activity_title: activeActivity.title,
        category: activeActivity.category,
      });
    }

    setTimeout(() => {
      setActiveActivity(null);
      setSelectedActivity(null);
      setCompletedTitle(null);
    }, 900);
  };

  const renderMonth = ({ item }: { item: { year: number; month: number; label: string } }) => {
    const matrix = getMonthMatrix(item.year, item.month);

    return (
      <View style={styles.monthCard}>
        <Text style={styles.monthLabel}>{item.label}</Text>
        <View style={styles.weekHeader}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <Text key={`${day}-${index}`} style={styles.weekHeaderText}>{day}</Text>
          ))}
        </View>
        <View style={styles.monthGrid}>
          {matrix.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.weekRow}>
              {week.map((day, dayIndex) => {
                if (!day) return <View key={dayIndex} style={styles.dayEmpty} />;
                const key = localDateKey(day);
                const count = countsByDate.get(key) || 0;
                const intensity = Math.min(1, count / maxCount);
                const bg = count ? `rgba(232,216,112,${0.18 + intensity * 0.62})` : SURFACE;
                const isSelected = selectedDate === key;

                return (
                  <Pressable
                    key={key}
                    onPress={() => setSelectedDate(isSelected ? null : key)}
                    style={({ pressed }) => [
                      styles.daySquare,
                      { backgroundColor: bg },
                      isSelected && styles.daySelected,
                      pressed && styles.dayPressed,
                    ]}
                  >
                    <Text style={styles.dayLabel}>{day.getDate()}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        style={pageMotion}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl onRefresh={handleRefresh} refreshing={refreshing} tintColor={INK} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.greetingBlock}>
              <Text style={styles.greetingEyebrow}>
                {new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
              </Text>
              <Text style={styles.greetingName}>
                {getGreeting()},{'\n'}{profile?.name || 'there'}.
              </Text>
              {(profile?.role || profile?.company) && (
                <Text style={styles.context}>
                  {[profile?.role, profile?.company ? `at ${profile.company}` : ''].filter(Boolean).join(' ')}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <View style={styles.metricAccentDot} />
            <Text style={styles.metricValue}>{Math.min(logs.length, 7)}</Text>
            <Text style={styles.metricLabel}>day streak</Text>
          </View>
          <View style={styles.metricCard}>
            <View style={styles.metricAccentDot} />
            <Text style={styles.metricValue}>{formatPercent(weeklyProductivityPercent)}</Text>
            <Text style={styles.metricLabel}>avg. productivity</Text>
          </View>
        </View>

        <Pressable
          onPress={() => navigation.navigate('AddLog')}
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        >
          <Text style={styles.addButtonText}>+ Add Daily Log</Text>
        </Pressable>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Calendar</Text>
          <View style={styles.sectionDivider} />
        </View>

        <FlatList
          data={months}
          horizontal
          keyExtractor={(item) => `${item.year}-${item.month}`}
          renderItem={renderMonth}
          snapToInterval={SCREEN_WIDTH}
          snapToAlignment="start"
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.monthsRow}
          ItemSeparatorComponent={() => <View style={{ width: 48 }} />}
        />

        {selectedDate && (
          <View style={styles.dateNote}>
            <Text style={styles.dateNoteText}>
              {selectedDateCount ? `${selectedDateCount} log${selectedDateCount > 1 ? 's' : ''} on this day.` : 'No logs on this day.'}
            </Text>
          </View>
        )}

        {selectedDate && (
          <Pressable
            onPress={handleAddLogForDate}
            style={({ pressed }) => [styles.calendarActionButton, pressed && styles.addButtonPressed]}
          >
            <Text style={styles.calendarActionButtonText}>+ Add Log for {formatCalendarDate(selectedDate)}</Text>
          </Pressable>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{activeActivity ? 'Ongoing Tasks' : 'Growth Actions'}</Text>
          <View style={styles.sectionDivider} />
        </View>

        {activeActivity ? (
          <GrowthActionCard
            description={activeActivity.shortDescription}
            eyebrow="In progress"
            onPress={() => setSelectedActivity(activeActivity)}
            title={activeActivity.title}
          />
        ) : (
          <View style={styles.categoryGrid}>
            {categories.map((category) => (
              <GrowthActionCard
                key={category.id}
                description={category.description || 'Small professional action.'}
                eyebrow={`${category.activities.length} prompts`}
                onPress={() => openRandomActivity(category)}
                title={category.title}
              />
            ))}
          </View>
        )}

        {loading && <ActivityIndicator color={INK} style={styles.loading} />}
      </Animated.ScrollView>

      <ActivityModal
        activity={selectedActivity}
        active={!!activeActivity && selectedActivity?.id === activeActivity.id}
        completedTitle={completedTitle}
        onClose={() => setSelectedActivity(null)}
        onStart={handleStartActivity}
        onComplete={handleCompleteActivity}
      />
    </View>
  );
}

function GrowthActionCard({
  title,
  description,
  eyebrow,
  onPress,
}: {
  title: string;
  description?: string;
  eyebrow: string;
  onPress: () => void;
}) {
  const press = React.useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(press, {
      toValue: value,
      damping: 18,
      mass: 0.7,
      stiffness: 220,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[styles.growthActionShell, { transform: [{ scale: press }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(0.985)}
        onPressOut={() => animateTo(1)}
        style={styles.growthActionCard}
      >

        <Text style={styles.growthActionTitle}>{title}</Text>
        <Text numberOfLines={2} style={styles.growthActionText}>
          {description}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function ActivityModal({
  activity,
  active,
  completedTitle,
  onClose,
  onStart,
  onComplete,
}: {
  activity: (GrowthActivity & { category: string }) | null;
  active: boolean;
  completedTitle: string | null;
  onClose: () => void;
  onStart: () => void;
  onComplete: () => void;
}) {
  return (
    <Modal transparent visible={!!activity} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <View style={styles.activityCard}>
          <View style={styles.activityTopRow}>
            <Text style={styles.activityCategory}>{activity?.category}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>x</Text>
            </Pressable>
          </View>
          <Text style={styles.activityTitle}>{activity?.title}</Text>
          <Text style={styles.activityDescription}>{activity?.shortDescription}</Text>

          <ActivityDetail label="Purpose" value={activity?.motive || activity?.objective} />
          <ActivityDetail label="What to do" value={activity?.task?.whatToDo} />
          <ActivityDetail label="Suggested approach" value={activity?.task?.howToDo || activity?.task?.suggestedStarter} />
          <ActivityDetail label="Duration" value={activity?.duration} />

          {completedTitle === activity?.title && <Text style={styles.completeText}>Completed. Nice and simple.</Text>}

          <Pressable onPress={active ? onComplete : onStart} style={({ pressed }) => [styles.modalPrimary, pressed && styles.addButtonPressed]}>
            <Text style={styles.modalPrimaryText}>{active ? 'Mark as Complete' : 'Start Task'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ActivityDetail({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.activityDetail}>
      <Text style={styles.activityDetailLabel}>{label}</Text>
      <Text style={styles.activityDetailText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WHITE },
  scrollContent: { paddingBottom: 60 },
  header: { paddingHorizontal: 24, paddingTop: 68, paddingBottom: 8 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingRight: 56 },
  greetingBlock: { flex: 1, paddingRight: 12 },
  greetingEyebrow: { fontSize: 12, color: MUTED, fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  greetingName: { fontSize: 36, fontWeight: '800', color: INK, lineHeight: 42, letterSpacing: -0.8 },
  context: { fontSize: 13, color: MUTED, marginTop: 6, fontWeight: '400' },
  metricsRow: { flexDirection: 'row', marginHorizontal: 24, marginTop: 32, gap: 12 },
  metricCard: { flex: 1, backgroundColor: SURFACE, borderRadius: 32, padding: 20, paddingTop: 18 },
  metricAccentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: YELLOW, marginBottom: 14 },
  metricValue: { fontSize: 30, fontWeight: '800', color: INK, letterSpacing: -1, lineHeight: 34 },
  metricLabel: { fontSize: 12, color: MUTED, marginTop: 4, fontWeight: '500', letterSpacing: 0.2 },
  addButton: { marginHorizontal: 24, marginTop: 20, backgroundColor: INK, borderRadius: 32, alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  addButtonPressed: { backgroundColor: '#2A2A28' },
  addButtonText: { color: WHITE, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, marginTop: 36, marginBottom: 16, gap: 14 },
  sectionTitle: { fontSize: 11, color: MUTED, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase' },
  sectionDivider: { flex: 1, height: 1, backgroundColor: BORDER },
  monthsRow: { paddingHorizontal: 24 },
  monthCard: { width: MONTH_CARD_WIDTH, backgroundColor: WHITE, borderWidth: 0, borderColor: BORDER, borderRadius: 28, padding: 18 },
  monthLabel: { fontSize: 18, color: INK, marginBottom: 14, fontWeight: '800', letterSpacing: -0.3 },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  weekHeaderText: { width: 34, textAlign: 'center', color: MUTED, fontSize: 10, fontWeight: '800' },
  monthGrid: { gap: 6 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  dayEmpty: { width: 34, height: 34 },
  daySquare: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  dayLabel: { fontSize: 12, color: INK, fontWeight: '700' },
  daySelected: { borderColor: INK, borderWidth: 2 },
  dayPressed: { opacity: 0.78 },
  dateNote: { marginHorizontal: 24, marginTop: 12, backgroundColor: '#FEFDF9', borderRadius: 18, padding: 12, borderWidth: 1, borderColor: BORDER },
  dateNoteText: { color: MUTED, fontSize: 13, fontWeight: '600' },
  calendarActionButton: { marginHorizontal: 24, marginTop: 12, backgroundColor: INK, borderRadius: 28, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  calendarActionButtonText: { color: WHITE, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  categoryGrid: { marginHorizontal: 24, gap: 10 },
  growthActionShell: {
    backgroundColor: WHITE,
    borderRadius: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  growthActionCard: {
    alignItems: 'center',
    backgroundColor: '#FFFDF4',
    borderColor: BORDER,
    borderRadius: 34,
    borderWidth: 1,
    minHeight: 72,
    overflow: 'hidden',
    padding: 13,
  },
  growthActionEyebrow: { color: MUTED, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textAlign: 'center', textTransform: 'uppercase' },
  growthActionArrow: {
    alignItems: 'center',
    backgroundColor: INK,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  growthActionArrowText: { color: WHITE, fontSize: 18, fontWeight: '500', lineHeight: 22 },
  growthActionTitle: { color: INK, fontSize: 18, fontWeight: '800', letterSpacing: -0.25, lineHeight: 23, textAlign: 'center' },
  growthActionText: { color: MUTED, fontSize: 10, fontWeight: '500', lineHeight: 19, marginTop: 2, textAlign: 'center' },
  modalScrim: { flex: 1, backgroundColor: 'rgba(13,13,13,0.32)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  activityCard: {
    width: '100%',
    backgroundColor: WHITE,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 8,
  },
  activityTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  activityCategory: { color: '#7A6A10', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  closeButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BORDER },
  closeText: { color: MUTED, fontWeight: '800', fontSize: 15 },
  activityTitle: { color: INK, fontSize: 25, fontWeight: '800', letterSpacing: -0.5, lineHeight: 30 },
  activityDescription: { color: INK_SOFT, fontSize: 14, lineHeight: 22, marginTop: 9, marginBottom: 16 },
  activityDetail: { borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 12, marginTop: 12 },
  activityDetailLabel: { color: MUTED, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
  activityDetailText: { color: INK_SOFT, fontSize: 14, lineHeight: 21 },
  modalPrimary: { backgroundColor: INK, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, marginTop: 22 },
  modalPrimaryText: { color: WHITE, fontSize: 15, fontWeight: '800' },
  completeText: { color: '#7A6A10', fontSize: 13, fontWeight: '800', marginTop: 16 },
  loading: { marginTop: 30 },
});
