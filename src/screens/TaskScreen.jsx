import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  SectionList,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
  { key: 'morning', glyph: '⛅', selected: '#8ECDF5' },
  { key: 'afternoon', glyph: '☀', selected: '#F59A38' },
  { key: 'evening', glyph: '◑', selected: '#E9C93A' },
  { key: 'night', glyph: '☾', selected: '#102F78' },
];

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
  } catch (e) {
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

function targetDateFor(option) {
  const today = new Date();
  if (option === 'tomorrow') return addDays(today, 1);
  if (option === 'week') {
    const day = today.getDay();
    const daysToFriday = day <= 5 ? 5 - day : 0;
    return addDays(today, daysToFriday);
  }
  return today;
}

function formatDateLabel(value) {
  const date = new Date(`${value}T12:00:00`);
  const today = dateKey(new Date());
  const tomorrow = dateKey(addDays(new Date(), 1));

  if (value === today) return 'Today';
  if (value === tomorrow) return 'Tomorrow';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
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
                  const glyphColor = isColorDark(bg) ? WHITE : INK;
                  return (
                    <View style={[styles.timeBadge, { backgroundColor: bg, borderColor: bg }]}> 
                      <Text style={[styles.timeGlyph, { color: glyphColor }]}>{opt.glyph}</Text>
                    </View>
                  );
                })()}
              </View>
            </Animated.View>

            {active && (
              <Pressable onPress={handleComplete} style={styles.checkHitbox}>
                  <Animated.View style={[styles.checkBubble, finishing && styles.checkBubbleDone, { opacity: completeProgress, transform: [{ scale: checkScale }] }] }>
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
    const groups = { Today: [], Tomorrow: [], 'This Week': [] };

    visibleTasks.forEach((task) => {
      if (task.date === todayKey) groups.Today.push(task);
      else if (task.date === tomorrowKey) groups.Tomorrow.push(task);
      else {
        groups['This Week'].push(task);
      }
    });

    const out = [];
    if (groups.Today.length) out.push({ title: 'Today', data: groups.Today });
    if (groups.Tomorrow.length) out.push({ title: 'Tomorrow', data: groups.Tomorrow });
    if (groups['This Week'].length) out.push({ title: 'This Week', data: groups['This Week'] });
    return out;
  }, [visibleTasks]);

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
    setTasks((current) => current.filter((task) => task.id !== id));
  }, []);

  const completeTask = useCallback((id) => {
    setActiveCompleteId(null);
    setTasks((current) => current.filter((task) => task.id !== id));
  }, []);

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.contentMotion, pageMotion]}>
        <SectionList
          contentContainerStyle={styles.container}
          sections={sections}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.title}>Your Tasks</Text>
              <Text style={styles.subtitle}>{taskCountLabel(visibleTasks.length)}</Text>
            </View>
          }
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionHeader}>{title}</Text>
          )}
          renderItem={({ item }) => (
            <TaskCard
              active={activeCompleteId === item.id}
              item={item}
              onComplete={completeTask}
              onDelete={deleteTask}
              onShowComplete={setActiveCompleteId}
            />
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
                  <Pressable
                    key={option.key}
                    onPress={() => setDateOption(option.key)}
                    style={[styles.dateChip, selected && styles.dateChipSelected]}
                  >
                    <Text style={[styles.dateChipText, selected && styles.dateChipTextSelected]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.timeRow}>
              {TIME_OPTIONS.map((option) => {
                const selected = timeOption === option.key;
                const bg = selected ? option.selected : INK;
                const glyphColor = isColorDark(bg) ? WHITE : INK;
                return (
                  <Pressable
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
                      <Text style={[styles.timeGlyph, { color: glyphColor }]}>{option.glyph}</Text>
                  </Pressable>
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
    backgroundColor: '#E84C4C',
    borderRadius: 18,
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
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 82,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  taskMain: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 12 },
  taskName: { color: INK, flex: 1, fontSize: 18, fontWeight: '800', lineHeight: 22 },
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
    borderWidth: 1,
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
  modalTitle: { color: INK, fontSize: 22, fontWeight: '800', marginBottom: 18 },
  input: {
    borderColor: BORDER,
    borderRadius: 18,
    borderWidth: 1,
    color: INK,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 18,
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 18, width: '100%' },
  dateChip: {
    backgroundColor: WHITE,
    borderColor: INK,
    borderRadius: 33,
    borderWidth: 1,
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
  timeGlyph: { fontSize: 20, fontWeight: '900' },
  sectionHeader: { color: MUTED, fontSize: 13, fontWeight: '900', marginBottom: 8, marginTop: 12 },

  addButton: {
    alignItems: 'center',
    backgroundColor: INK,
    borderRadius: 34,
    width: '100%',
    paddingVertical: 15,
  },
  addButtonPressed: { opacity: 0.8 },
  addButtonText: { color: WHITE, fontSize: 15, fontWeight: '800' },
});
