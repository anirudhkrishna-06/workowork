import { DailyLogWithAnalysis, Profile, WeeklyDaySummary, WeeklyReflection } from '../types/workowork';
import { supabase } from './supabase';

const DAY_MS = 24 * 60 * 60 * 1000;

function getAnalysis(log: DailyLogWithAnalysis) {
  if (Array.isArray(log.ai_analysis)) return log.ai_analysis[0] ?? null;
  return log.ai_analysis ?? null;
}

function localDateKey(dateInput: Date | string) {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function parseProfileDate(value: string) {
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateOnly) return new Date(value);

  const [, year, month, day] = dateOnly;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function uniq(items: string[], limit = 8) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, limit);
}

function firstInternshipDate(profile: Profile | null, logs: DailyLogWithAnalysis[]) {
  if (profile?.internship_start_date) return parseProfileDate(profile.internship_start_date);
  if (logs[0]?.created_at) return new Date(logs[0].created_at);
  return new Date();
}

export function getWeekRange(profile: Profile | null, weekNumber: number, logs: DailyLogWithAnalysis[] = []) {
  const start = firstInternshipDate(profile, logs);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + (weekNumber - 1) * 7);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function availableWeekNumbers(profile: Profile | null, logs: DailyLogWithAnalysis[], generated: WeeklyReflection[]) {
  if (!logs.length) return [];
  const base = firstInternshipDate(profile, logs).getTime();
  const maxWeekFromLogs = logs.reduce((max, log) => {
    const week = Math.floor((new Date(log.created_at).getTime() - base) / (DAY_MS * 7)) + 1;
    return Math.max(max, week);
  }, 1);
  const maxWeekFromGenerated = generated.reduce((max, item) => Math.max(max, item.week_number), 0);
  const maxWeek = Math.max(maxWeekFromLogs, maxWeekFromGenerated, 1);
  return Array.from({ length: maxWeek }, (_, index) => index + 1);
}

export function nextUngeneratedWeek(profile: Profile | null, logs: DailyLogWithAnalysis[], generated: WeeklyReflection[]) {
  const completed = new Set(generated.filter((item) => item.status === 'completed').map((item) => item.week_number));
  return availableWeekNumbers(profile, logs, generated).find((week) => !completed.has(week)) ?? null;
}

export function buildWeeklyPayload({
  profile,
  logs,
  weekNumber,
  periodStart,
  periodEnd,
}: {
  profile: Profile | null;
  logs: DailyLogWithAnalysis[];
  weekNumber: number;
  periodStart: Date;
  periodEnd: Date;
}) {
  const dayMap = new Map<string, WeeklyDaySummary>();

  logs.forEach((log) => {
    const key = localDateKey(log.created_at);
    const analysis = getAnalysis(log);
    const summary = analysis?.professional_summary || log.task;
    const existing = dayMap.get(key);
    if (existing) {
      existing.summaries.push(summary);
      return;
    }
    dayMap.set(key, {
      date: key,
      label: new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(log.created_at)),
      summaries: [summary],
    });
  });

  const analyses = logs.map(getAnalysis).filter(Boolean);
  const tasks = uniq(logs.map((log) => log.task), 8);
  const tools = uniq(analyses.flatMap((analysis) => analysis?.skills ?? []), 10);
  const challenges = uniq([
    ...logs.map((log) => log.challenge),
    ...analyses.flatMap((analysis) => analysis?.weaknesses ?? []),
  ], 8);
  const goals = uniq([
    ...logs.map((log) => log.tomorrow_plan),
    ...analyses.flatMap((analysis) => analysis?.suggestions ?? []),
  ], 6);
  const improvements = uniq(analyses.flatMap((analysis) => analysis?.skills ?? []), 6);

  const weeklySummary = logs.length
    ? `Week ${weekNumber} covered ${logs.length} log ${logs.length === 1 ? 'entry' : 'entries'} from ${formatDate(periodStart)} to ${formatDate(periodEnd)}. The main work centered on ${tasks.slice(0, 3).join(', ') || 'documented internship activity'}.`
    : `Week ${weekNumber} has no logged activity yet.`;

  return {
    week_number: weekNumber,
    log_count: logs.length,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    weekly_summary: weeklySummary,
    tasks_accomplishments: tasks,
    tools_technologies: tools,
    challenges_blockers: challenges,
    goals_next_week: goals,
    day_summaries: [...dayMap.values()],
    improvements,
    recurring_weaknesses: challenges,
    suggestions: goals,
    status: 'completed' as const,
  };
}

export async function generateStoredWeeklyReport({
  userId,
  profile,
  weekNumber,
}: {
  userId: string;
  profile: Profile | null;
  weekNumber: number;
}) {
  const { data: allLogs, error: allLogsError } = await supabase
    .from('daily_logs')
    .select('*, ai_analysis(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (allLogsError) throw allLogsError;

  const logs = (allLogs ?? []) as DailyLogWithAnalysis[];
  const { start, end } = getWeekRange(profile, weekNumber, logs);
  const weekLogs = logs.filter((log) => {
    const date = new Date(log.created_at).getTime();
    return date >= start.getTime() && date <= end.getTime();
  });

  if (!weekLogs.length) {
    throw new Error(`No log entries found for week ${weekNumber}.`);
  }

  const payload = buildWeeklyPayload({
    profile,
    logs: weekLogs,
    weekNumber,
    periodStart: start,
    periodEnd: end,
  });

  const { data, error } = await supabase
    .from('weekly_reflections')
    .upsert(
      {
        user_id: userId,
        ...payload,
      },
      { onConflict: 'user_id,week_number' }
    )
    .select('*')
    .single();

  if (error) throw error;
  return data as WeeklyReflection;
}
