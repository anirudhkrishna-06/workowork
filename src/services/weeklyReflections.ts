import { generateWeeklyReflection } from './gemini';
import { supabase } from './supabase';
import { buildWeeklyPayload } from './weeklyReports';
import { DailyLogWithAnalysis, GeneratedWeeklyReflection, Profile } from '../types/workowork';

function payloadFromReflection(reflection: GeneratedWeeklyReflection) {
  return {
    weekly_summary: reflection.weekly_summary,
    tasks_accomplishments: reflection.tasks_accomplishments,
    tools_technologies: reflection.takeaways,
    challenges_blockers: reflection.challenges_blockers,
    goals_next_week: reflection.goals_next_week,
    improvements: reflection.improvements,
    recurring_weaknesses: reflection.recurring_weaknesses,
    suggestions: reflection.suggestions,
  };
}

export async function processWeeklyReflectionIfDue(profile: Profile | null, userId: string) {
  const { count, error: countError } = await supabase
    .from('daily_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError || !count || count % 7 !== 0) {
    return;
  }

  const weekNumber = count / 7;

  const { data: existing } = await supabase
    .from('weekly_reflections')
    .select('id,status')
    .eq('user_id', userId)
    .eq('week_number', weekNumber)
    .maybeSingle();

  if (existing?.status === 'completed' || existing?.status === 'processing') {
    return;
  }

  const { data: logs, error: logsError } = await supabase
    .from('daily_logs')
    .select('*, ai_analysis(*), mentor_feedback(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(7);

  if (logsError || !logs?.length) {
    return;
  }

  const orderedLogs = [...(logs as DailyLogWithAnalysis[])].reverse();
  const periodStart = orderedLogs[0]?.created_at ?? null;
  const periodEnd = orderedLogs[orderedLogs.length - 1]?.created_at ?? null;
  const storedReportPayload =
    periodStart && periodEnd
      ? buildWeeklyPayload({
          profile,
          logs: orderedLogs,
          weekNumber,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
        })
      : null;

  await supabase.from('weekly_reflections').upsert(
    {
      user_id: userId,
      week_number: weekNumber,
      log_count: orderedLogs.length,
      period_start: periodStart,
      period_end: periodEnd,
      status: 'processing',
    },
    { onConflict: 'user_id,week_number' }
  );

  try {
    const reflection = await generateWeeklyReflection(profile, orderedLogs, weekNumber);

    await supabase
      .from('weekly_reflections')
      .update({
        ...(storedReportPayload ?? {}),
        ...payloadFromReflection(reflection),
        created_at: new Date().toISOString(),
        status: 'completed',
      })
      .eq('user_id', userId)
      .eq('week_number', weekNumber);
  } catch (error) {
    console.log('Weekly reflection failed', error);
    await supabase
      .from('weekly_reflections')
      .update({ status: 'failed' })
      .eq('user_id', userId)
      .eq('week_number', weekNumber);
  }
}
