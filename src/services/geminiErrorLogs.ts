import AsyncStorage from '@react-native-async-storage/async-storage';

import { errorDetails, preview } from '../utils/debug';

export type GeminiErrorSource = 'daily-analysis' | 'weekly-reflection' | 'unknown';

export type GeminiErrorLog = {
  id: string;
  source: GeminiErrorSource;
  message: string;
  details: string | null;
  createdAt: string;
};

const GEMINI_ERROR_LOGS_KEY = 'workowork.geminiErrorLogs';
const GEMINI_SIDEBAR_ACK_KEY = 'workowork.geminiSidebarAcknowledgedAt';
const GEMINI_CARD_DISMISSED_KEY = 'workowork.geminiCardDismissedAt';

const listeners = new Set<() => void>();

function notifyChange() {
  listeners.forEach((listener) => listener());
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readTimestamp(key: string) {
  const value = await AsyncStorage.getItem(key);
  if (!value) return 0;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function writeTimestamp(key: string) {
  await AsyncStorage.setItem(key, String(Date.now()));
}

async function readLogs() {
  const raw = await AsyncStorage.getItem(GEMINI_ERROR_LOGS_KEY);
  if (!raw) return [] as GeminiErrorLog[];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GeminiErrorLog[]) : [];
  } catch {
    return [] as GeminiErrorLog[];
  }
}

async function writeLogs(logs: GeminiErrorLog[]) {
  await AsyncStorage.setItem(GEMINI_ERROR_LOGS_KEY, JSON.stringify(logs));
}

function serializeError(error: unknown) {
  const details = errorDetails(error);

  if (typeof details === 'string') {
    return preview(details, 1200);
  }

  try {
    return preview(JSON.stringify(details), 1200);
  } catch {
    return preview(String(details), 1200);
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return 'Gemini request failed.';
}

export function subscribeToGeminiErrorChanges(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function recordGeminiError(source: GeminiErrorSource, error: unknown) {
  const logs = await readLogs();
  const entry: GeminiErrorLog = {
    id: createId(),
    source,
    message: getErrorMessage(error),
    details: serializeError(error),
    createdAt: new Date().toISOString(),
  };

  logs.push(entry);
  await writeLogs(logs);
  notifyChange();
  return entry;
}

export async function getLatestGeminiErrorLog() {
  const logs = await readLogs();
  return logs[logs.length - 1] ?? null;
}

export async function getVisibleGeminiErrorLog() {
  const [latestLog, dismissedAt] = await Promise.all([getLatestGeminiErrorLog(), readTimestamp(GEMINI_CARD_DISMISSED_KEY)]);

  if (!latestLog) return null;
  return new Date(latestLog.createdAt).getTime() > dismissedAt ? latestLog : null;
}

export async function hasGeminiSidebarAlert() {
  const [latestLog, acknowledgedAt] = await Promise.all([getLatestGeminiErrorLog(), readTimestamp(GEMINI_SIDEBAR_ACK_KEY)]);

  if (!latestLog) return false;
  return new Date(latestLog.createdAt).getTime() > acknowledgedAt;
}

export async function acknowledgeGeminiSidebarAlert() {
  await writeTimestamp(GEMINI_SIDEBAR_ACK_KEY);
  notifyChange();
}

export async function dismissGeminiErrorCard() {
  await writeTimestamp(GEMINI_CARD_DISMISSED_KEY);
  notifyChange();
}
