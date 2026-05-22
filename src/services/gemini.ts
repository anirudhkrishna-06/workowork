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
  logs: DailyLogWithAnalysis[]
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
Productivity: ${log.productivity}/5 (${scoreToPercent(log.productivity)}%)
Confidence: ${log.confidence}/5 (${scoreToPercent(log.confidence)}%)
Stress: ${log.stress}/5 (${scoreToPercent(log.stress)}%)
AI summary: ${analysis?.professional_summary ?? 'Not available'}
AI weaknesses: ${(analysis?.weaknesses ?? []).join(', ') || 'Not available'}
Mentor feedback: ${feedback.map((item) => item.feedback).join(' | ') || 'None'}
`;
    })
    .join('\n');

  const prompt = `
You are WorkoWork, an AI assistant for internship/work reflection.

Return ONLY valid JSON. No markdown. No commentary.

JSON schema:
{
  "weekly_summary": "A concise paragraph describing the user's weekly growth.",
  "improvements": ["Area improved"],
  "recurring_weaknesses": ["Recurring weakness"],
  "suggestions": ["Specific suggestion for next week"]
}

Reflection rules:
- Treat productivity, confidence, and stress as 1-5 ratings and use the percentage beside each score for interpretation.
- Preserve technical specificity when logs mention implementation, tools, debugging, architecture, analysis, or delivery. Use supportive non-technical coaching when logs are primarily emotional.
- Tie improvements, recurring weaknesses, and suggestions to Amazon Leadership Principles where relevant, especially Ownership, Learn and Be Curious, Dive Deep, Bias for Action, Insist on the Highest Standards, Earn Trust, and Deliver Results.

User context:
Name: ${profile?.name ?? 'Unknown'}
Role: ${profile?.role ?? 'Intern'}
Company: ${profile?.company ?? 'Unknown'}
Goal: ${profile?.goal ?? 'Not provided'}

Seven-log block:
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
