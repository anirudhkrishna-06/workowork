export type Profile = {
  id: string;
  name: string | null;
  email: string | null;
  company: string | null;
  role: string | null;
  goal: string | null;
  duration: string | null;
  internship_start_date?: string | null;
  internship_end_date?: string | null;
  department?: string | null;
  reporting_manager?: string | null;
  created_at: string;
};

export type DailyLog = {
  id: string;
  user_id: string;
  task: string;
  learning: string;
  challenge: string;
  solution: string;
  productivity: number;
  confidence: number;
  stress: number;
  tomorrow_plan: string;
  created_at: string;
};

export type MentorFeedback = {
  id: string;
  log_id: string;
  feedback: string;
  created_at: string;
};

export type AiAnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type AiAnalysis = {
  id: string;
  log_id: string;
  professional_summary: string | null;
  skills: string[] | null;
  weaknesses: string[] | null;
  suggestions: string[] | null;
  resume_bullet: string | null;
  status: AiAnalysisStatus;
  created_at: string;
};

export type DailyLogWithAnalysis = DailyLog & {
  ai_analysis?: AiAnalysis | AiAnalysis[] | null;
  mentor_feedback?: MentorFeedback | MentorFeedback[] | null;
};

export type LogAnalysisInput = Pick<
  DailyLog,
  | 'id'
  | 'task'
  | 'learning'
  | 'challenge'
  | 'solution'
  | 'productivity'
  | 'confidence'
  | 'stress'
  | 'tomorrow_plan'
  | 'created_at'
>;

export type GeneratedLogAnalysis = {
  professional_summary: string;
  skills: string[];
  weaknesses: string[];
  suggestions: string[];
  resume_bullet: string;
};

export type WeeklyReflectionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type WeeklyReflection = {
  id: string;
  user_id: string;
  week_number: number;
  log_count: number;
  period_start: string | null;
  period_end: string | null;
  weekly_summary: string | null;
  tasks_accomplishments?: string[] | null;
  tools_technologies?: string[] | null;
  challenges_blockers?: string[] | null;
  goals_next_week?: string[] | null;
  day_summaries?: WeeklyDaySummary[] | null;
  improvements: string[] | null;
  recurring_weaknesses: string[] | null;
  suggestions: string[] | null;
  status: WeeklyReflectionStatus;
  created_at: string;
};

export type WeeklyDaySummary = {
  date: string;
  label: string;
  summaries: string[];
};

export type GeneratedWeeklyReflection = {
  weekly_summary: string;
  tasks_accomplishments: string[];
  takeaways: string[];
  challenges_blockers: string[];
  goals_next_week: string[];
  improvements: string[];
  recurring_weaknesses: string[];
  suggestions: string[];
};
