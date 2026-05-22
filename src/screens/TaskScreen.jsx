import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  SectionList,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';

import { useEntranceMotion } from '../utils/useEntranceMotion';

const STORAGE_KEY = 'workowork.tasks.v1';
const INK = '#0D0D0D';
const WHITE = '#FFFFFF';
const MUTED = '#85857D';
const BORDER = '#E9E8E1';
const GREEN = '#20B15A';

const DATE_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'week', label: 'This Week' },
];

const TIME_OPTIONS = [
  { key: 'morning', icon: 'partly-sunny-outline', selected: '#047ace' },
  { key: 'afternoon', icon: 'sunny-outline', selected: '#8f0000' },
  { key: 'evening', icon: 'contrast-outline', selected: '#E9C93A' },
  { key: 'night', icon: 'moon-outline', selected: '#102F78' },
];

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const bigint = parseInt(h, 16);
  if (h.length === 6) {
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
  }
  return { r: 0, g: 0, b: 0 };
}

function isColorDark(hex) {
  try {
    const { r, g, b } = hexToRgb(hex);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.6;
  } catch (_e) {
    return false;
  }
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function endOfWeek(date) {
  const next = new Date(date);
  const day = next.getDay();
  const daysToSunday = day === 0 ? 0 : 7 - day;
  next.setDate(next.getDate() + daysToSunday);
  return next;
}

function targetDateFor(option) {
  const today = new Date();
  if (option === 'tomorrow') return addDays(today, 1);
  if (option === 'week') return endOfWeek(today);
  return today;
}

function cardTone(date) {
  const today = dateKey(new Date());
  const tomorrow = dateKey(addDays(new Date(), 1));

  // Use neutral white / grey tones for card backgrounds
  if (date === today) return { backgroundColor: '#FFFFFF', borderColor: '#E9E9E9' };
  if (date === tomorrow) return { backgroundColor: '#FAFAFA', borderColor: '#EFEFEF' };
  return { backgroundColor: '#F7F7F8', borderColor: '#ECECEC' };
}

function taskCountLabel(count) {
  if (count === 0) return 'No tasks yet';
  if (count === 1) return '1 task waiting';
  return `${count} tasks waiting`;
}

function TaskCard({ item, active, onShowComplete, onComplete, onDelete }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const completeProgress = useRef(new Animated.Value(0)).current;
  const removeProgress = useRef(new Animated.Value(1)).current;
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (!active) setFinishing(false);
    Animated.timing(completeProgress, {
      toValue: active ? 1 : 0,
      duration: 210,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active, completeProgress]);

  const removeTask = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 420,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(removeProgress, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(() => onDelete(item.id));
  }, [item.id, onDelete, removeProgress, translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => gesture.dx > 9 && Math.abs(gesture.dy) < 12,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dx > 0) translateX.setValue(Math.min(gesture.dx, 128));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > 96 || gesture.vx > 0.85) {
            removeTask();
            return;
          }

          Animated.spring(translateX, {
            toValue: 0,
            damping: 17,
            stiffness: 190,
            useNativeDriver: true,
          }).start();
        },
      }),
    [removeTask, translateX]
  );

  const tone = cardTone(item.date);
  const checkScale = completeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });
  const checkOpacity = completeProgress.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, 1, 1],
  });
  const contentOpacity = completeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.12],
  });

  const handleComplete = () => {
    setFinishing(true);
    Animated.sequence([
      Animated.timing(completeProgress, {
        toValue: 2,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(removeProgress, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(translateX, {
          toValue: 36,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => onComplete(item.id));
  };

  return (
    <Animated.View
      style={[
        styles.cardWrap,
        {
          opacity: removeProgress,
          maxHeight: removeProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 106] }),
          marginBottom: removeProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }),
        },
      ]}
    >
      <View style={styles.deleteBack}>
        <Ionicons name="trash-outline" size={22} color={WHITE} />
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable onPress={() => onShowComplete(item.id)}>
          <Animated.View
            style={[
              styles.taskCard,
              {
                backgroundColor: completeProgress.interpolate({
                  inputRange: [0, 1, 2],
                  outputRange: [tone.backgroundColor, WHITE, GREEN],
                }),
                borderColor: active ? '#D6D6CF' : tone.borderColor,
              },
            ]}
          >
            <Animated.View style={[styles.taskMain, { opacity: contentOpacity }]}>
              <Text numberOfLines={2} style={styles.taskName}>{item.name}</Text>
              <View style={styles.taskMeta}>
                {(() => {
                  const opt = TIME_OPTIONS.find((o) => o.key === item.time) || TIME_OPTIONS[0];
                  const bg = opt.selected;
                  const iconColor = isColorDark(bg) ? WHITE : INK;
                  return (
                    <View style={[styles.timeBadge, { backgroundColor: bg, borderColor: bg }]}> 
                      <Ionicons name={opt.icon} size={19} color={iconColor} />
                    </View>
                  );
                })()}
              </View>
            </Animated.View>

            {active && (
              <Pressable onPress={handleComplete} style={styles.checkHitbox}>
                  <Animated.View style={[styles.checkBubble, finishing && styles.checkBubbleDone, { opacity: checkOpacity, transform: [{ scale: checkScale }] }] }>
                    <Ionicons name="checkmark" size={34} color={finishing ? WHITE : GREEN} />
                  </Animated.View>
              </Pressable>
            )}
          </Animated.View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function AnimatedOption({ accessibilityLabel, children, onPress, style }) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value) => {
    Animated.spring(scale, {
      toValue: value,
      damping: 14,
      mass: 0.45,
      stiffness: 260,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onPressIn={() => animateTo(0.93)}
        onPressOut={() => animateTo(1)}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default function TaskScreen() {
  const pageMotion = useEntranceMotion();
  const modalScale = useRef(new Animated.Value(0.94)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const [tasks, setTasks] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [dateOption, setDateOption] = useState('today');
  const [timeOption, setTimeOption] = useState('morning');
  const [activeCompleteId, setActiveCompleteId] = useState(null);
  const [overdueOpen, setOverdueOpen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored) setTasks(JSON.parse(stored));
      })
      .catch(() => setTasks([]));
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)).catch(() => {});
  }, [tasks]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(modalOpacity, {
        toValue: modalVisible ? 1 : 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(modalScale, {
        toValue: modalVisible ? 1 : 0.94,
        damping: 18,
        stiffness: 210,
        useNativeDriver: true,
      }),
    ]).start();
  }, [modalOpacity, modalScale, modalVisible]);

  const visibleTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.createdAt - b.createdAt;
      }),
    [tasks]
  );

  const sections = useMemo(() => {
    const todayKey = dateKey(new Date());
    const tomorrowKey = dateKey(addDays(new Date(), 1));
    const weekEndKey = dateKey(endOfWeek(new Date()));
    const groups = { Overdue: [], Today: [], Tomorrow: [], 'This Week': [], Later: [] };

    visibleTasks.forEach((task) => {
      if (task.date < todayKey) groups.Overdue.push(task);
      else if (task.date === todayKey) groups.Today.push(task);
      else if (task.date === tomorrowKey) groups.Tomorrow.push(task);
      else if (task.date <= weekEndKey) {
        groups['This Week'].push(task);
      } else {
        groups.Later.push(task);
      }
    });

    const out = [];
    if (groups.Overdue.length) {
      out.push({
        title: 'Overdue',
        data: overdueOpen ? groups.Overdue : [],
        count: groups.Overdue.length,
        collapsible: true,
      });
    }
    if (groups.Today.length) out.push({ title: 'Today', data: groups.Today });
    if (groups.Tomorrow.length) out.push({ title: 'Tomorrow', data: groups.Tomorrow });
    if (groups['This Week'].length) out.push({ title: 'This Week', data: groups['This Week'] });
    if (groups.Later.length) out.push({ title: 'Later', data: groups.Later });
    return out;
  }, [overdueOpen, visibleTasks]);

  const resetForm = () => {
    setTaskName('');
    setDateOption('today');
    setTimeOption('morning');
  };

  const openModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
  };

  const addTask = () => {
    const trimmed = taskName.trim();
    if (!trimmed) return;

    const now = Date.now();
    setTasks((current) => [
      ...current,
      {
        id: `${now}`,
        name: trimmed,
        date: dateKey(targetDateFor(dateOption)),
        time: timeOption,
        createdAt: now,
      },
    ]);
    closeModal();
    resetForm();
  };

  const deleteTask = useCallback((id) => {
    setActiveCompleteId((current) => (current === id ? null : current));
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks((current) => current.filter((task) => task.id !== id));
  }, []);

  const completeTask = useCallback((id) => {
    setActiveCompleteId(null);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks((current) => current.filter((task) => task.id !== id));
  }, []);

  const toggleOverdue = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOverdueOpen((current) => !current);
  }, []);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.contentMotion, pageMotion]}>
        <SectionList
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          onTouchStart={() => {
            if (activeCompleteId) setActiveCompleteId(null);
          }}
          sections={sections}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.title}>Your Tasks</Text>
              <Text style={styles.subtitle}>{taskCountLabel(visibleTasks.length)}</Text>
            </View>
          }
          renderSectionHeader={({ section }) =>
            section.collapsible ? (
              <Pressable onPress={toggleOverdue} style={styles.overdueHeader}>
                <Text style={styles.sectionHeader}>{section.title}</Text>
                <View style={styles.overdueRight}>
                  <Text style={styles.overdueCount}>{section.count}</Text>
                  <Ionicons name={overdueOpen ? 'chevron-up' : 'chevron-down'} size={16} color={MUTED} />
                </View>
              </Pressable>
            ) : (
              <Text style={styles.sectionHeader}>{section.title}</Text>
            )
          }
          renderItem={({ item }) => (
            <View
              onTouchStart={(event) => {
                event.stopPropagation();
              }}
            >
              <TaskCard
                active={activeCompleteId === item.id}
                item={item}
                onComplete={completeTask}
                onDelete={deleteTask}
                onShowComplete={setActiveCompleteId}
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Nothing pending</Text>
              <Text style={styles.emptyText}>Tap the plus button to add your next task.</Text>
            </View>
          }
        />
      </Animated.View>

      <Pressable accessibilityLabel="Add task" onPress={openModal} style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}>
        <Ionicons name="add" size={32} color={WHITE} />
      </Pressable>

      <Modal transparent visible={modalVisible} animationType="fade" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
          <Pressable style={styles.modalScrim} onPress={closeModal} />
          <Animated.View style={[styles.modalCard, { opacity: modalOpacity, transform: [{ scale: modalScale }] }]}>
            <Text style={styles.modalTitle}>Add Task</Text>
            <TextInput
              autoFocus
              onChangeText={setTaskName}
              placeholder="Name of the task"
              placeholderTextColor="#A0A09A"
              returnKeyType="done"
              style={styles.input}
              value={taskName}
            />

            <View style={styles.chipRow}>
              {DATE_OPTIONS.map((option) => {
                const selected = dateOption === option.key;
                return (
                  <AnimatedOption
                    key={option.key}
                    onPress={() => setDateOption(option.key)}
                    style={[styles.dateChip, selected && styles.dateChipSelected]}
                  >
                    <Text style={[styles.dateChipText, selected && styles.dateChipTextSelected]}>{option.label}</Text>
                  </AnimatedOption>
                );
              })}
            </View>

            <View style={styles.timeRow}>
              {TIME_OPTIONS.map((option) => {
                const selected = timeOption === option.key;
                const bg = selected ? option.selected : INK;
                const iconColor = isColorDark(bg) ? WHITE : INK;
                return (
                  <AnimatedOption
                    accessibilityLabel={option.key}
                    key={option.key}
                    onPress={() => setTimeOption(option.key)}
                    style={[
                      styles.timeButton,
                      {
                        backgroundColor: bg,
                        borderColor: bg,
                      },
                    ]}
                  >
                      <Ionicons name={option.icon} size={21} color={iconColor} />
                  </AnimatedOption>
                );
              })}
            </View>

            <Pressable onPress={addTask} style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}>
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAF6' },
  contentMotion: { flex: 1 },
  container: { paddingHorizontal: 24, paddingTop: 88, paddingBottom: 120 },
  header: { paddingRight: 58, marginBottom: 24 },
  title: { color: INK, fontSize: 42, fontWeight: '800' },
  subtitle: { color: MUTED, fontSize: 14, lineHeight: 22, marginTop: 6 },
  cardWrap: { overflow: 'hidden' },
  deleteBack: {
    alignItems: 'flex-start',
    backgroundColor: '#e84c4c83',
    borderRadius: 38,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingLeft: 22,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  taskCard: {
    alignItems: 'center',
    borderRadius: 38,
    borderWidth: 0.2,
    flexDirection: 'row',
    minHeight: 42,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  taskMain: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12 },
  taskName: { color: INK, flex: 1, fontSize: 18, fontWeight: '400', lineHeight: 22 },
  taskMeta: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkHitbox: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBubble: {
    alignItems: 'center',
    backgroundColor: WHITE,
    borderColor: '#E2E2DA',
    borderRadius: 34,
    borderWidth: 0,
    height: 68,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    width: 68,
  },
  checkBubbleDone: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  emptyState: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 70 },
  emptyTitle: { color: INK, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  emptyText: { color: MUTED, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  fab: {
    alignItems: 'center',
    backgroundColor: INK,
    borderRadius: 34,
    bottom: 32,
    height: 68,
    justifyContent: 'center',
    position: 'absolute',
    right: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    width: 68,
    zIndex: 10,
  },
  fabPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  modalRoot: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  modalScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13,13,13,0.28)' },
  modalCard: {
    alignItems: 'center',
    backgroundColor: WHITE,
    borderColor: BORDER,
    borderRadius: 24,
    borderWidth: 1,
    maxWidth: 420,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 26,
    width: '100%',
  },
  modalTitle: { color: INK, fontSize: 18, fontWeight: '600', marginBottom: 18 },
  input: {
    borderColor: BORDER,
    borderRadius: 38,
    borderWidth: 1,
    color: INK,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 18,
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 18, width: '100%' },
  dateChip: {
    backgroundColor: WHITE,
    borderColor: INK,
    borderRadius: 33,
    borderWidth: 0.4,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dateChipSelected: { backgroundColor: INK },
  dateChipText: { color: INK, fontSize: 12, fontWeight: '800' },
  dateChipTextSelected: { color: WHITE },
  timeRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 22, width: '100%' },
  timeButton: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },

  timeBadge: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  sectionHeader: { color: MUTED, fontSize: 13, fontWeight: '900', marginBottom: 8, marginTop: 12 },
  overdueHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overdueRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  overdueCount: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
  },

  addButton: {
    alignItems: 'center',
    backgroundColor: INK,
    borderRadius: 34,
    width: '100%',
    paddingVertical: 12,
  },
  addButtonPressed: { opacity: 0.8 },
  addButtonText: { color: WHITE, fontSize: 13, fontWeight: '600' },
});
