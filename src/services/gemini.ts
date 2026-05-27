import {
  DailyLogWithAnalysis,
  GeneratedLogAnalysis,
  GeneratedWeeklyReflection,
  LogAnalysisInput,
  Profile,
} from '../types/workowork';
import { debugLog, preview } from '../utils/debug';
import { scoreToPercent } from '../utils/scores';
import { getGeminiApiKey } from './userSettings';
import { recordGeminiError } from './geminiAlerts';

function extractJson(text: string) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAnalysis(value: unknown): GeneratedLogAnalysis {
  if (!value || typeof value !== 'object') {
    throw new Error('Gemini returned an invalid analysis shape.');
  }

  const record = value as Record<string, unknown>;

  return {
    professional_summary:
      typeof record.professional_summary === 'string' ? record.professional_summary.trim() : '',
    skills: asStringArray(record.skills),
    weaknesses: asStringArray(record.weaknesses),
    suggestions: asStringArray(record.suggestions),
    resume_bullet: typeof record.resume_bullet === 'string' ? record.resume_bullet.trim() : '',
  };
}

function normalizeWeeklyReflection(value: unknown): GeneratedWeeklyReflection {
  if (!value || typeof value !== 'object') {
    throw new Error('Gemini returned an invalid weekly reflection shape.');
  }

  const record = value as Record<string, unknown>;

  return {
    weekly_summary: typeof record.weekly_summary === 'string' ? record.weekly_summary.trim() : '',
    tasks_accomplishments: asStringArray(record.tasks_accomplishments),
    takeaways: asStringArray(record.takeaways),
    challenges_blockers: asStringArray(record.challenges_blockers),
    goals_next_week: asStringArray(record.goals_next_week),
    improvements: asStringArray(record.improvements),
    recurring_weaknesses: asStringArray(record.recurring_weaknesses),
    suggestions: asStringArray(record.suggestions),
  };
}

export const generateLogAnalysis = async (
  profile: Profile | null,
  log: LogAnalysisInput
): Promise<GeneratedLogAnalysis> => {
  const apiKey = await getGeminiApiKey();

  if (!apiKey) {
    debugLog('Gemini', 'Missing Gemini API key for daily analysis', { logId: log.id });
    throw new Error('Add your Gemini API key in Settings before using AI generation.');
  }

  const prompt = `
You are WorkoWork, an AI assistant for internship/work journals.

Return ONLY valid JSON. No markdown. No commentary.

JSON schema:
{
  "professional_summary": "One polished professional sentence about the work completed.",
  "skills": ["Skill or tool", "Skill or tool"],
  "weaknesses": ["Specific growth area"],
  "suggestions": ["Concrete improvement suggestion"],
  "resume_bullet": "One resume-ready bullet without exaggerated claims."
}

Analysis rules:
- Treat productivity, confidence, and stress as 1-5 ratings; also use the percentage shown beside each score for user-facing interpretation.
- Adapt the tone to the raw log. If the user describes tools, code, systems, debugging, architecture, analysis, metrics, implementation, or project delivery, respond with concrete technical language. If the user mainly describes emotional state, loneliness, uncertainty, or confidence issues, respond in a supportive non-technical way.
- Ground every insight in at least one Amazon Leadership Principle when relevant: Customer Obsession, Ownership, Invent and Simplify, Are Right A Lot, Learn and Be Curious, Hire and Develop the Best, Insist on the Highest Standards, Think Big, Bias for Action, Frugality, Earn Trust, Dive Deep, Have Backbone; Disagree and Commit, Deliver Results, Strive to be Earth's Best Employer, Success and Scale Bring Broad Responsibility.
- Keep the leadership-principle mapping natural and specific. Do not force jargon, but make suggestions and weaknesses reflect the principle being practiced or needed.
- Do not invent technologies, deliverables, or business outcomes that are not present in the log.

User context:
Name: ${profile?.name ?? 'Unknown'}
Role: ${profile?.role ?? 'Intern'}
Company: ${profile?.company ?? 'Unknown'}
Duration: ${profile?.duration ?? 'Unknown'}
Goal: ${profile?.goal ?? 'Not provided'}

Daily log:
Work done: ${log.task}
Learning: ${log.learning}
Challenges: ${log.challenge}
Solutions: ${log.solution}
Productivity: ${log.productivity}/5 (${scoreToPercent(log.productivity)}%)
Confidence: ${log.confidence}/5 (${scoreToPercent(log.confidence)}%)
Stress: ${log.stress}/5 (${scoreToPercent(log.stress)}%)
Tomorrow plan: ${log.tomorrow_plan}
`;

  debugLog('Gemini', 'Sending daily analysis request', {
    logId: log.id,
    model: 'gemini-2.5-flash',
    promptLength: prompt.length,
  });

  let jsonText = '';

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const message = await response.text();
      debugLog('Gemini', 'Daily analysis HTTP error', {
        logId: log.id,
        status: response.status,
        statusText: response.statusText,
        body: preview(message),
      });
      throw new Error(message || 'Gemini request failed.');
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    debugLog('Gemini', 'Daily analysis response received', {
      logId: log.id,
      candidateCount: Array.isArray(data?.candidates) ? data.candidates.length : 0,
      textPreview: typeof text === 'string' ? preview(text) : text,
    });

    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('Gemini returned an empty response.');
    }

    jsonText = extractJson(text);
    debugLog('Gemini', 'Daily analysis JSON extracted', {
      logId: log.id,
      jsonPreview: preview(jsonText),
    });

    return normalizeAnalysis(JSON.parse(jsonText));
  } catch (error) {
    debugLog('Gemini', 'Daily analysis JSON parse/normalize failed', {
      logId: log.id,
      jsonPreview: preview(jsonText),
      error,
    });
    throw error;
  }
};

export const generateWeeklyReflection = async (
  profile: Profile | null,
  logs: DailyLogWithAnalysis[],
  weekNumber?: number
): Promise<GeneratedWeeklyReflection> => {
  const apiKey = await getGeminiApiKey();

  if (!apiKey) {
    throw new Error('Add your Gemini API key in Settings before using AI generation.');
  }

  const logText = logs
    .map((log, index) => {
      const analysis = Array.isArray(log.ai_analysis) ? log.ai_analysis[0] : log.ai_analysis;
      const feedback = Array.isArray(log.mentor_feedback) ? log.mentor_feedback : log.mentor_feedback ? [log.mentor_feedback] : [];

      return `
Log ${index + 1}
Date: ${log.created_at}
Work done: ${log.task}
Learning: ${log.learning}
Challenges: ${log.challenge}
Solutions: ${log.solution}
Tomorrow plan: ${log.tomorrow_plan}
Productivity: ${log.productivity}/5 (${scoreToPercent(log.productivity)}%)
Confidence: ${log.confidence}/5 (${scoreToPercent(log.confidence)}%)
Stress: ${log.stress}/5 (${scoreToPercent(log.stress)}%)
AI summary: ${analysis?.professional_summary ?? 'Not available'}
AI skills / growth signals: ${(analysis?.skills ?? []).join(', ') || 'Not available'}
AI weaknesses: ${(analysis?.weaknesses ?? []).join(', ') || 'Not available'}
AI suggestions: ${(analysis?.suggestions ?? []).join(', ') || 'Not available'}
Mentor feedback: ${feedback.map((item) => item.feedback).join(' | ') || 'None'}
`;
    })
    .join('\n');

  const prompt = `
You are WorkoWork, an AI assistant for internship/work reflection.

Return ONLY valid JSON. No markdown. No commentary.

JSON schema:
{
  "weekly_summary": "One polished corporate paragraph only.",
  "tasks_accomplishments": ["Crisp task/accomplishment bullet"],
  "takeaways": [
    "TAKEAWAY: Personal weekly correction or learning",
    "TOP_LP: Leadership Principle name - evidence from the week",
    "BOTTOM_LP: Leadership Principle name - focus area from the week"
  ],
  "challenges_blockers": ["Specific challenge/blocker bullet"],
  "goals_next_week": ["Specific next-week goal bullet"],
  "improvements": ["Area improved"],
  "recurring_weaknesses": ["Recurring weakness"],
  "suggestions": ["Specific suggestion for next week"]
}

Reflection rules:
- Generate every section from the supplied weekly logs and existing daily AI analysis. Use all available days in the weekly block. Do not use filler, vague praise, invented technologies, invented outcomes, or generic internship language.
- weekly_summary must be one polished executive paragraph only. Do not start with a formula such as "Week ${weekNumber ?? 'X'} covered ${logs.length} log entries." Write it like a real manager-ready progress summary: crisp opening, then what the individual learned, where they lagged, where they improved, and how the week reflects growth. Keep it professional, precise, and commendable.
- For weekly_summary, draw heavily from each day's learning, AI skills / growth signals, AI weaknesses, AI suggestions, score patterns, and solved challenges. Do not make sub-points.
- tasks_accomplishments must contain 5-10 crisp task definitions derived from the daily work summaries and raw "Work done" fields. Group tiny items into meaningful workstreams. Use short, corporate, outcome-oriented phrasing.
- takeaways must begin with 3-5 TAKEAWAY entries about what the individual learned to correct or carry forward.
- takeaways must also include exactly 3 TOP_LP entries for the strongest LPs demonstrated and exactly 3 BOTTOM_LP entries for the weakest LPs or focus areas. Use only these LP names: Customer Obsession, Ownership, Invent and Simplify, Are Right A Lot, Learn and Be Curious, Hire and Develop the Best, Insist on the Highest Standards, Think Big, Bias for Action, Frugality, Earn Trust, Dive Deep, Have Backbone; Disagree and Commit, Deliver Results.
- Do not write "Amazon" anywhere. Use the TOP_LP / BOTTOM_LP prefixes exactly so the report can highlight the top 3 and bottom 3 LPs.
- challenges_blockers must contain 3-6 crisp, real challenges faced by the individual. Remove weak, duplicate, exaggerated, or unnecessary challenges.
- goals_next_week must contain 4-7 motivating, professional goals created from areas to grow, weaknesses, suggestions, and tomorrow plans. Do not repeat completed work from this week as a goal.
- Treat productivity, confidence, and stress as 1-5 ratings and use the percentage beside each score for interpretation.
- Preserve technical specificity when logs mention implementation, tools, debugging, architecture, analysis, or delivery. Use supportive non-technical coaching when logs are primarily emotional.
- Keep bullets concise but meaningful. Prefer action language, measurable direction, and professional phrasing.

User context:
Name: ${profile?.name ?? 'Unknown'}
Role: ${profile?.role ?? 'Intern'}
Company: ${profile?.company ?? 'Unknown'}
Goal: ${profile?.goal ?? 'Not provided'}

Weekly log block:
${logText}
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Gemini weekly reflection request failed.');
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('Gemini returned an empty weekly reflection response.');
    }

    return normalizeWeeklyReflection(JSON.parse(extractJson(text)));
  } catch (error) {
    await recordGeminiError('weekly-reflection', error);
    throw error;
  }
};
