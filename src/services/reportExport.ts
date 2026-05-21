import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

import { Profile, WeeklyReflection } from '../types/workowork';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function listHtml(items?: string[] | null) {
  if (!items?.length) {
    return '<p class="muted">Not available.</p>';
  }

  return `<ul class="clean-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function reportStyles() {
  return `
    @page { margin: 28px; }
    * { box-sizing: border-box; }
    body {
      background: #F7F7F3;
      color: #161615;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      line-height: 1.58;
      margin: 0;
      padding: 0;
    }
    .page {
      background: #FFFFFF;
      border: 1px solid #E7E5DD;
      border-radius: 18px;
      padding: 30px;
    }
    .hero {
      background: #111110;
      border-radius: 18px;
      color: #FFFFFF;
      margin-bottom: 22px;
      padding: 26px;
    }
    .eyebrow {
      color: #E8D870;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1.4px;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    h1 {
      font-size: 30px;
      letter-spacing: -0.8px;
      line-height: 1.08;
      margin: 0;
    }
    .hero-sub {
      color: rgba(255,255,255,0.68);
      font-size: 12px;
      margin-top: 10px;
    }
    .meta-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(2, 1fr);
      margin: 18px 0 24px;
    }
    .meta-item {
      background: #F7F7F3;
      border: 1px solid #E7E5DD;
      border-radius: 14px;
      padding: 12px 14px;
    }
    .meta-label {
      color: #8A8A82;
      display: block;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 1px;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .meta-value {
      color: #161615;
      font-size: 13px;
      font-weight: 700;
    }
    .section {
      background: #FFFFFF;
      border: 1px solid #E7E5DD;
      border-radius: 16px;
      margin-top: 14px;
      page-break-inside: avoid;
      padding: 18px;
    }
    .section-title-row {
      align-items: center;
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
    }
    .section-number {
      align-items: center;
      background: #E8D870;
      border-radius: 999px;
      color: #111110;
      display: inline-flex;
      font-size: 11px;
      font-weight: 900;
      height: 24px;
      justify-content: center;
      min-width: 24px;
      padding: 0 8px;
    }
    h2 {
      color: #161615;
      font-size: 16px;
      letter-spacing: -0.2px;
      margin: 0;
    }
    h3 {
      color: #161615;
      font-size: 13px;
      margin: 0 0 8px;
    }
    p {
      color: #343430;
      font-size: 12.5px;
      margin: 0;
    }
    .muted { color: #8A8A82; }
    .clean-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .clean-list li {
      border-top: 1px solid #EFEDE6;
      color: #343430;
      font-size: 12.5px;
      padding: 8px 0 8px 18px;
      position: relative;
    }
    .clean-list li:first-child { border-top: 0; }
    .clean-list li:before {
      background: #E8D870;
      border-radius: 50%;
      content: "";
      height: 6px;
      left: 0;
      position: absolute;
      top: 16px;
      width: 6px;
    }
    .summary-box {
      background: #FBFAF5;
      border-left: 4px solid #E8D870;
      border-radius: 14px;
      padding: 14px 16px;
    }
    .two-col {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(2, 1fr);
    }
    .day-card {
      background: #FBFAF5;
      border: 1px solid #E7E5DD;
      border-radius: 14px;
      margin-top: 10px;
      page-break-inside: avoid;
      padding: 14px;
    }
    .footer {
      border-top: 1px solid #E7E5DD;
      color: #8A8A82;
      font-size: 10px;
      margin-top: 22px;
      padding-top: 12px;
      text-align: center;
    }
  `;
}

function metaItem(label: string, value?: string | null) {
  return `
    <div class="meta-item">
      <span class="meta-label">${escapeHtml(label)}</span>
      <span class="meta-value">${escapeHtml(value || 'Not available')}</span>
    </div>
  `;
}

function sectionHtml(index: string, title: string, body: string) {
  return `
    <section class="section">
      <div class="section-title-row">
        <span class="section-number">${escapeHtml(index)}</span>
        <h2>${escapeHtml(title)}</h2>
      </div>
      ${body}
    </section>
  `;
}

function formatReportDate(value?: string | null) {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export function weeklyReportToHtml(report: WeeklyReflection, profile: Profile | null) {
  const daySummaries = Array.isArray(report.day_summaries) ? report.day_summaries : [];

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>${reportStyles()}</style>
  </head>
  <body>
    <main class="page">
      <header class="hero">
        <div class="eyebrow">Week ${report.week_number} Progress Report</div>
        <h1>Internship Weekly Progress Report</h1>
        <div class="hero-sub">${escapeHtml(formatReportDate(report.period_start))} to ${escapeHtml(formatReportDate(report.period_end))}</div>
      </header>

      <div class="meta-grid">
        ${metaItem('Name', profile?.name)}
        ${metaItem('Role', profile?.role)}
        ${metaItem('Department', profile?.department ?? 'Engineering / Development')}
        ${metaItem('Reporting Manager', profile?.reporting_manager)}
        ${metaItem('Week Ending', formatReportDate(report.period_end))}
        ${metaItem('Log Entries', String(report.log_count ?? 0))}
      </div>

      ${sectionHtml('01', 'Executive Summary', `<div class="summary-box"><p>${escapeHtml(report.weekly_summary ?? 'Weekly report generated from daily entries.')}</p></div>`)}
      ${sectionHtml('02', 'Tasks & Accomplishments', listHtml(report.tasks_accomplishments))}
      <div class="two-col">
        ${sectionHtml('03', 'Tools & Technologies Used', listHtml(report.tools_technologies))}
        ${sectionHtml('04', 'Challenges & Blockers', listHtml(report.challenges_blockers?.length ? report.challenges_blockers : report.recurring_weaknesses))}
      </div>
      ${sectionHtml('05', 'Goals for Next Week', listHtml(report.goals_next_week?.length ? report.goals_next_week : report.suggestions))}
      <section class="section">
        <div class="section-title-row">
          <span class="section-number">06</span>
          <h2>Day Wise Summary</h2>
        </div>
        ${
          daySummaries.length
            ? daySummaries
                .map(
                  (day) => `
                    <div class="day-card">
                      <h3>${escapeHtml(day.label)}</h3>
                      ${listHtml(day.summaries)}
                    </div>
                  `
                )
                .join('')
            : '<p class="muted">No day wise summaries available.</p>'
        }
      </section>

      <div class="footer">Generated with WorkoWork</div>
    </main>
  </body>
</html>
`;
}

export async function exportWeeklyReportAsPdf(report: WeeklyReflection, profile: Profile | null) {
  const { uri } = await Print.printToFileAsync({
    html: weeklyReportToHtml(report, profile),
    base64: false,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      dialogTitle: `Export Week ${report.week_number} Report`,
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    });
    return;
  }

  await Share.share({
    title: `Week ${report.week_number} Report`,
    message: uri,
  });
}
