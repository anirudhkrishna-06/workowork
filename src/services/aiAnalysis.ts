import { supabase } from './supabase';
import { generateLogAnalysis } from './gemini';
import { recordGeminiError } from './geminiAlerts';
import { debugLog, errorDetails } from '../utils/debug';
import {
  AiAnalysis,
  DailyLog,
  GeneratedLogAnalysis,
  LogAnalysisInput,
  Profile,
} from '../types/workowork';

function toAnalysisPayload(analysis: GeneratedLogAnalysis) {
  return {
    professional_summary: analysis.professional_summary,
    skills: analysis.skills,
    weaknesses: analysis.weaknesses,
    suggestions: analysis.suggestions,
    resume_bullet: analysis.resume_bullet,
  };
}

export async function createPendingAnalysis(logId: string) {
  debugLog('AI', 'Creating pending analysis row', { logId });

  const { data, error } = await supabase
    .from('ai_analysis')
    .upsert(
      {
        log_id: logId,
        status: 'pending',
      },
      { onConflict: 'log_id' }
    )
    .select('*')
    .single();

  if (error) {
    debugLog('AI', 'Failed to create pending analysis row', { logId, error });
    throw error;
  }

  debugLog('AI', 'Pending analysis row ready', { logId, analysisId: data.id, status: data.status });
  return data as AiAnalysis;
}

export async function processLogAnalysis(profile: Profile | null, log: LogAnalysisInput) {
  debugLog('AI', 'Starting daily analysis pipeline', {
    logId: log.id,
    hasProfile: !!profile,
    taskLength: log.task.length,
  });

  try {
    const { error: processingError } = await supabase.from('ai_analysis').upsert(
      {
        log_id: log.id,
        status: 'processing',
      },
      { onConflict: 'log_id' }
    );

    if (processingError) {
      debugLog('AI', 'Failed to mark analysis as processing', { logId: log.id, error: processingError });
      throw processingError;
    }

    debugLog('AI', 'Marked analysis as processing', { logId: log.id });

    const analysis = await generateLogAnalysis(profile, log);
    debugLog('AI', 'Gemini analysis generated', {
      logId: log.id,
      summaryLength: analysis.professional_summary.length,
      skillsCount: analysis.skills.length,
      weaknessesCount: analysis.weaknesses.length,
      suggestionsCount: analysis.suggestions.length,
      resumeBulletLength: analysis.resume_bullet.length,
    });

    const { error } = await supabase
      .from('ai_analysis')
      .update({
        ...toAnalysisPayload(analysis),
        status: 'completed',
      })
      .eq('log_id', log.id);

    if (error) {
      debugLog('AI', 'Failed to store completed analysis', { logId: log.id, error });
      throw error;
    }

    debugLog('AI', 'Daily analysis completed and stored', { logId: log.id });
  } catch (error) {
    debugLog('AI', 'Daily analysis pipeline failed', { logId: log.id, error: errorDetails(error) });
    const contextualError = error instanceof Error ? error : new Error(String(error));
    contextualError.message = `Daily analysis failed for log ${log.id}: ${contextualError.message}`;

    try {
      await recordGeminiError('daily-analysis', contextualError);
    } catch (recordError) {
      debugLog('AI', 'Failed to record daily analysis error', {
        logId: log.id,
        error: errorDetails(recordError),
      });
    }

    const { error: failedError } = await supabase
      .from('ai_analysis')
      .upsert(
        {
          log_id: log.id,
          status: 'failed',
        },
        { onConflict: 'log_id' }
      );

    if (failedError) {
      debugLog('AI', 'Failed to mark analysis as failed', { logId: log.id, error: failedError });
    } else {
      debugLog('AI', 'Marked analysis as failed', { logId: log.id });
    }
  }
}

export async function retryLogAnalysis(profile: Profile | null, log: DailyLog) {
  debugLog('AI', 'Retry requested for daily analysis', { logId: log.id });
  await createPendingAnalysis(log.id);
  await processLogAnalysis(profile, log);
}
