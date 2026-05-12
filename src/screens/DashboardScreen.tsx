import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../services/supabase';
import { AiAnalysis, DailyLogWithAnalysis, WeeklyReflection } from '../types/workowork';

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const t = {
  bg: '#F9F8F6',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F3F0',
  primary: '#0D0D0D',
  accent: '#E8C84A',
  accentMuted: '#F5E68A',
  accentSubtle: '#FBF5D6',
  muted: '#9B9690',
  mutedLight: '#C8C4BE',
  border: '#EBEBEA',
  radius: 32,
  radiusSm: 20,
};

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getAnalysis(log: DailyLogWithAnalysis) {
  if (Array.isArray(log.ai_analysis)) return log.ai_analysis[0] ?? null;
  return log.ai_analysis ?? null;
}

function topItems(items: string[], limit = 4) {
  const counts = new Map<string, number>();
  items.forEach((item) => counts.set(item, (counts.get(item) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label]) => label);
}

function formatDate(value?: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

// ─── Trend Sparkline ──────────────────────────────────────────────────────────
function TrendLine({ data, width = 280, height = 64 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;

  const padX = 12;
  const padY = 10;
  const w = width - padX * 2;
  const h = height - padY * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => ({
    x: padX + (i / (data.length - 1)) * w,
    y: padY + h - ((v - min) / range) * h,
  }));

  // Build smooth path via bezier
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpX = (prev.x + curr.x) / 2;
    d += ` C ${cpX} ${prev.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`;
  }

  const last = pts[pts.length - 1];

  return (
    <Svg width={width} height={height} style={{ overflow: 'visible' }}>
      {/* Baseline */}
      <Line
        x1={padX} y1={padY + h}
        x2={padX + w} y2={padY + h}
        stroke={t.border} strokeWidth={1}
      />
      {/* Trend line */}
      <Path d={d} fill="none" stroke={t.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Data dots */}
      {pts.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3} fill={i === pts.length - 1 ? t.accent : t.accentMuted} />
      ))}
      {/* Last value label */}
      <Circle cx={last.x} cy={last.y} r={5} fill={t.accent} />
    </Svg>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[mc.card, accent && mc.cardAccent]}>
      <Text style={[mc.value, accent && mc.valueAccent]}>{value}</Text>
      <Text style={[mc.label, accent && mc.labelAccent]}>{label}</Text>
    </View>
  );
}

const mc = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: t.surface,
    borderRadius: t.radius,
    padding: 18,
    gap: 5,
    borderWidth: 1,
    borderColor: t.border,
    minWidth: '45%',
  },
  cardAccent: { backgroundColor: t.accentSubtle, borderColor: t.accentMuted },
  value: { color: t.primary, fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  valueAccent: { color: '#6B5A0A' },
  label: { color: t.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  labelAccent: { color: '#9B8520' },
});

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={sh.wrap}>
      <Text style={sh.title}>{title}</Text>
      {sub && <Text style={sh.sub}>{sub}</Text>}
    </View>
  );
}

const sh = StyleSheet.create({
  wrap: { gap: 3, marginBottom: 14 },
  title: { color: t.primary, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  sub: { color: t.muted, fontSize: 13 },
});

// ─── Tag Pill ─────────────────────────────────────────────────────────────────
function TagPill({ label, dim }: { label: string; dim?: boolean }) {
  return (
    <View style={[tp.pill, dim && tp.pillDim]}>
      <Text style={[tp.text, dim && tp.textDim]}>{label}</Text>
    </View>
  );
}

const tp = StyleSheet.create({
  pill: {
    backgroundColor: t.accentSubtle,
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: t.accentMuted,
  },
  pillDim: { backgroundColor: t.surfaceAlt, borderColor: t.border },
  text: { color: '#6B5A0A', fontSize: 13, fontWeight: '700' },
  textDim: { color: t.muted },
});

// ─── Weekly Card ──────────────────────────────────────────────────────────────
function WeekCard({ reflection }: { reflection: WeeklyReflection }) {
  const pending = reflection.status !== 'completed';
  return (
    <View style={wc.card}>
      <View style={wc.topRow}>
        <View style={wc.weekBadge}>
          <Text style={wc.weekNum}>W{reflection.week_number}</Text>
        </View>
        <Text style={wc.dateRange}>
          {formatDate(reflection.period_start)} – {formatDate(reflection.period_end)}
        </Text>
        {pending && (
          <View style={wc.statusBadge}>
            <Text style={wc.statusText}>{reflection.status}</Text>
          </View>
        )}
      </View>
      <Text style={wc.summary} numberOfLines={pending ? 1 : 5}>
        {pending
          ? `Reflection ${reflection.status}.`
          : reflection.weekly_summary}
      </Text>
    </View>
  );
}

const wc = StyleSheet.create({
  card: {
    backgroundColor: t.surface,
    borderRadius: t.radius,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: t.border,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  weekBadge: {
    backgroundColor: t.primary,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  weekNum: { color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  dateRange: { color: t.muted, fontSize: 13, fontWeight: '600', flex: 1 },
  statusBadge: {
    backgroundColor: t.surfaceAlt,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: t.border,
  },
  statusText: { color: t.muted, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  summary: { color: t.primary, fontSize: 14, lineHeight: 22 },
});

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyNote({ text }: { text: string }) {
  return (
    <View style={en.wrap}>
      <Text style={en.text}>{text}</Text>
    </View>
  );
}
const en = StyleSheet.create({
  wrap: {
    backgroundColor: t.surfaceAlt,
    borderRadius: t.radiusSm,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  text: { color: t.muted, fontSize: 14, lineHeight: 21 },
});

// ─── Divider ──────────────────────────────────────────────────────────────────
function Divider() {
  return <View style={{ height: 1, backgroundColor: t.border, marginVertical: 6 }} />;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }: Props) {
  const { session } = useAuth();
  const [logs, setLogs] = useState<DailyLogWithAnalysis[]>([]);
  const [weeklyReflections, setWeeklyReflections] = useState<WeeklyReflection[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!session?.user.id) return;

    const [{ data: logsData, error: logsError }, { data: weeklyData, error: weeklyError }] =
      await Promise.all([
        supabase
          .from('daily_logs')
          .select('*, ai_analysis(*)')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('weekly_reflections')
          .select('*')
          .eq('user_id', session.user.id)
          .order('week_number', { ascending: false }),
      ]);

    if (logsError) console.log('Dashboard logs failed', logsError.message);
    if (weeklyError) console.log('Dashboard weekly reflections failed', weeklyError.message);

    setLogs(logsError ? [] : ((logsData ?? []) as DailyLogWithAnalysis[]));
    setWeeklyReflections(weeklyError ? [] : ((weeklyData ?? []) as WeeklyReflection[]));
    setLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  // ── Derived data (unchanged logic) ──────────────────────────────────────────
  const analyses = logs
    .map((log) => getAnalysis(log))
    .filter((a): a is AiAnalysis => !!a);

  const weeklyLogs = logs.slice(0, 7);
  const weeklyProductivity = weeklyLogs.length
    ? Math.round(
        weeklyLogs.reduce((total, log) => total + Number(log.productivity ?? 0), 0) /
          weeklyLogs.length
      )
    : 0;

  const confidenceTrend = logs
    .slice(0, 7)
    .reverse()
    .map((log) => log.confidence);

  const avgConfidence = confidenceTrend.length
    ? Math.round(confidenceTrend.reduce((a, b) => a + b, 0) / confidenceTrend.length)
    : null;

  const skills = topItems(analyses.flatMap((a) => a.skills ?? []));
  const weaknesses = topItems(analyses.flatMap((a) => a.weaknesses ?? []));

  // Trend insight text
  const trendInsight = (() => {
    if (confidenceTrend.length < 3) return null;
    const first = confidenceTrend.slice(0, 3).reduce((a, b) => a + b) / 3;
    const last = confidenceTrend.slice(-3).reduce((a, b) => a + b) / 3;
    if (last > first + 0.5) return 'Confidence has been climbing this week.';
    if (last < first - 0.5) return 'A dip this week — thats worth reflecting on.';
    return 'Confidence has stayed steady lately.';
  })();

  return (
    <ScrollView
      contentContainerStyle={s.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <View style={s.header}>
        <Text style={s.title}>Dashboard</Text>
        <Text style={s.subtitle}>Small reflections reveal bigger progress.</Text>
      </View>

      {/* ── Report CTA ──────────────────────────────────────── */}
      <Pressable
        onPress={() => navigation.navigate('Report')}
        style={({ pressed }) => [s.reportBtn, pressed && s.reportBtnPressed]}
      >
        <View style={s.reportInner}>
          <View>
            <Text style={s.reportTitle}>Internship Report</Text>
            <Text style={s.reportSub}>Generate a full summary of your growth</Text>
          </View>
          <View style={s.reportArrow}>
            <Text style={s.reportArrowText}>→</Text>
          </View>
        </View>
      </Pressable>

      {/* ── Metrics ─────────────────────────────────────────── */}
      <View style={s.section}>
        <SectionHead title="At a glance" />
        <View style={s.metricsGrid}>
          <MetricCard label="Total Logs" value={String(logs.length)} />
          <MetricCard
            label="Current Streak"
            value={`${Math.min(logs.length, 7)}d`}
            accent
          />
          <MetricCard
            label="Weekly Productivity"
            value={weeklyProductivity ? `${weeklyProductivity}/10` : '—'}
          />
          <MetricCard
            label="Avg Confidence"
            value={avgConfidence ? `${avgConfidence}/10` : '—'}
            accent
          />
        </View>
      </View>

      <Divider />

      {/* ── Confidence Trend ────────────────────────────────── */}
      <View style={s.section}>
        <SectionHead
          title="Confidence trend"
          sub={trendInsight ?? 'Tracks your recent confidence scores.'}
        />
        {confidenceTrend.length >= 2 ? (
          <View style={s.trendCard}>
            <TrendLine data={confidenceTrend} width={320} height={72} />
            <View style={s.trendFooter}>
              {confidenceTrend.map((v, i) => (
                <Text key={i} style={s.trendTick}>{v}</Text>
              ))}
            </View>
          </View>
        ) : (
          <EmptyNote text="Patterns become visible after a few reflections." />
        )}
      </View>

      <Divider />

      {/* ── Skills ──────────────────────────────────────────── */}
      <View style={s.section}>
        <SectionHead title="Recurring strengths" sub="Skills surfaced by AI across your logs." />
        {skills.length ? (
          <View style={s.tagRow}>
            {skills.map((skill) => (
              <TagPill key={skill} label={skill} />
            ))}
          </View>
        ) : (
          <EmptyNote text="Insights become clearer over time." />
        )}
      </View>

      <Divider />

      {/* ── Weaknesses ──────────────────────────────────────── */}
      <View style={s.section}>
        <SectionHead title="Areas to grow" sub="Patterns worth paying attention to." />
        {weaknesses.length ? (
          <View style={s.tagRow}>
            {weaknesses.map((w) => (
              <TagPill key={w} label={w} dim />
            ))}
          </View>
        ) : (
          <EmptyNote text="Patterns appear after a few more reflections." />
        )}
      </View>

      <Divider />

      {/* ── Weekly Summaries ────────────────────────────────── */}
      <View style={s.section}>
        <SectionHead
          title="Weekly summaries"
          sub={weeklyReflections.length ? 'Your reflection archive.' : 'Generated every 7 logs.'}
        />
        {weeklyReflections.length ? (
          <View style={s.weekList}>
            {weeklyReflections.map((r) => (
              <WeekCard key={r.id} reflection={r} />
            ))}
          </View>
        ) : (
          <EmptyNote text="Weekly summaries will appear here once you've logged 7 reflections." />
        )}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  center: { alignItems: 'center', backgroundColor: t.bg, flex: 1, justifyContent: 'center' },
  container: {
    backgroundColor: t.bg,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 56,
    gap: 24,
  },

  // Header
  header: { gap: 6 },
  title: { color: t.primary, fontSize: 42, fontWeight: '800', letterSpacing: -1.5 },
  subtitle: { color: t.muted, fontSize: 14, lineHeight: 21 },

  // Report CTA
  reportBtn: {
    backgroundColor: t.primary,
    borderRadius: t.radius,
    overflow: 'hidden',
  },
  reportBtnPressed: { opacity: 0.85 },
  reportInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  reportTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  reportSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  reportArrow: {
    backgroundColor: t.accent,
    borderRadius: 99,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportArrowText: { color: t.primary, fontSize: 18, fontWeight: '800' },

  // Section
  section: { gap: 0 },

  // Metrics
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  // Trend
  trendCard: {
    backgroundColor: t.surface,
    borderRadius: t.radius,
    padding: 20,
    borderWidth: 1,
    borderColor: t.border,
    gap: 8,
  },
  trendFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  trendTick: { color: t.mutedLight, fontSize: 10, fontWeight: '700' },

  // Tags
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // Weekly
  weekList: { gap: 12 },
});