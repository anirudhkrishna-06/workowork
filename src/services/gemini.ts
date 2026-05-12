import {
  DailyLogWithAnalysis,
  GeneratedInternshipReport,
  GeneratedLogAnalysis,
  GeneratedWeeklyReflection,
  LogAnalysisInput,
  Profile,
  WeeklyReflection,
} from '../types/workowork';
import { debugLog, preview } from '../utils/debug';

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

function normalizeInternshipReport(value: unknown): GeneratedInternshipReport {
  if (!value || typeof value !== 'object') {
    throw new Error('Gemini returned an invalid report shape.');
  }

  const record = value as Record<string, unknown>;

  return {
    title: typeof record.title === 'string' ? record.title.trim() : 'Internship Report',
    introduction: typeof record.introduction === 'string' ? record.introduction.trim() : '',
    objectives: asStringArray(record.objectives),
    work_completed: asStringArray(record.work_completed),
    challenges: asStringArray(record.challenges),
    learnings: asStringArray(record.learnings),
    growth_summary: typeof record.growth_summary === 'string' ? record.growth_summary.trim() : '',
    conclusion: typeof record.conclusion === 'string' ? record.conclusion.trim() : '',
    resume_bullets: asStringArray(record.resume_bullets),
  };
}

export const generateLogAnalysis = async (
  profile: Profile | null,
  log: LogAnalysisInput
): Promise<GeneratedLogAnalysis> => {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    debugLog('Gemini', 'Missing Gemini API key for daily analysis', { logId: log.id });
    throw new Error('Missing Gemini API key.');
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
Productivity: ${log.productivity}/10
Confidence: ${log.confidence}/10
Stress: ${log.stress}/10
Tomorrow plan: ${log.tomorrow_plan}
`;

  debugLog('Gemini', 'Sending daily analysis request', {
    logId: log.id,
    model: 'gemini-2.5-flash',
    promptLength: prompt.length,
  });

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

  const jsonText = extractJson(text);
  debugLog('Gemini', 'Daily analysis JSON extracted', {
    logId: log.id,
    jsonPreview: preview(jsonText),
  });

  try {
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
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing Gemini API key.');
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
Productivity: ${log.productivity}/10
Confidence: ${log.confidence}/10
Stress: ${log.stress}/10
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

User context:
Name: ${profile?.name ?? 'Unknown'}
Role: ${profile?.role ?? 'Intern'}
Company: ${profile?.company ?? 'Unknown'}
Goal: ${profile?.goal ?? 'Not provided'}

Seven-log block:
${logText}
`;

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
};

export const generateInternshipReport = async ({
  profile,
  logs,
  weeklyReflections,
}: {
  profile: Profile | null;
  logs: DailyLogWithAnalysis[];
  weeklyReflections: WeeklyReflection[];
}): Promise<GeneratedInternshipReport> => {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing Gemini API key.');
  }

  const logText = logs
    .map((log, index) => {
      const analysis = Array.isArray(log.ai_analysis) ? log.ai_analysis[0] : log.ai_analysis;
      const feedback = Array.isArray(log.mentor_feedback) ? log.mentor_feedback : log.mentor_feedback ? [log.mentor_feedback] : [];

      return `
Entry ${index + 1}
Date: ${log.created_at}
Work: ${log.task}
Learning: ${log.learning}
Challenge: ${log.challenge}
Solution: ${log.solution}
Tomorrow plan: ${log.tomorrow_plan}
AI summary: ${analysis?.professional_summary ?? 'Not available'}
Skills: ${(analysis?.skills ?? []).join(', ') || 'Not available'}
Weaknesses: ${(analysis?.weaknesses ?? []).join(', ') || 'Not available'}
Suggestions: ${(analysis?.suggestions ?? []).join(', ') || 'Not available'}
Resume bullet: ${analysis?.resume_bullet ?? 'Not available'}
Mentor feedback: ${feedback.map((item) => item.feedback).join(' | ') || 'None'}
`;
    })
    .join('\n');

  const weeklyText = weeklyReflections
    .map(
      (reflection) => `
Week ${reflection.week_number}
Summary: ${reflection.weekly_summary ?? 'Not available'}
Improvements: ${(reflection.improvements ?? []).join(', ') || 'Not available'}
Recurring weaknesses: ${(reflection.recurring_weaknesses ?? []).join(', ') || 'Not available'}
Suggestions: ${(reflection.suggestions ?? []).join(', ') || 'Not available'}
`
    )
    .join('\n');

  const prompt = `
You are WorkoWork, an AI assistant that creates professional internship reports.

Return ONLY valid JSON. No markdown. No commentary.

JSON schema:
{
  "title": "Internship Report title",
  "introduction": "Professional introduction paragraph.",
  "objectives": ["Objective"],
  "work_completed": ["Meaningful work item"],
  "challenges": ["Challenge and how it was approached"],
  "learnings": ["Learning"],
  "growth_summary": "Reflective growth paragraph.",
  "conclusion": "Professional conclusion paragraph.",
  "resume_bullets": ["Resume-ready bullet"]
}

Use a professional but honest tone. Do not invent employer confidential details. Prefer concrete work from the logs.

Internship context:
Name: ${profile?.name ?? 'Unknown'}
Role: ${profile?.role ?? 'Intern'}
Company: ${profile?.company ?? 'Unknown'}
Duration: ${profile?.duration ?? 'Unknown'}
Goal: ${profile?.goal ?? 'Not provided'}

Weekly reflections:
${weeklyText || 'No weekly reflections available.'}

Chronological logs:
${logText || 'No logs available.'}
`;

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
    throw new Error(message || 'Gemini report request failed.');
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Gemini returned an empty report response.');
  }

  return normalizeInternshipReport(JSON.parse(extractJson(text)));
};
