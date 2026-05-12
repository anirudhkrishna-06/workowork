import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

import { InternshipReport, Profile } from '../types/workowork';

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
    return '<p>Not available.</p>';
  }

  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

export function reportToMarkdown(report: InternshipReport, profile: Profile | null) {
  const list = (items?: string[] | null) => (items?.length ? items.map((item) => `- ${item}`).join('\n') : 'Not available.');

  return `# ${report.title}

${profile?.name ? `Prepared by: ${profile.name}` : ''}
${profile?.role ? `Role: ${profile.role}` : ''}
${profile?.company ? `Company: ${profile.company}` : ''}
${profile?.duration ? `Duration: ${profile.duration}` : ''}

## Introduction
${report.introduction ?? 'Not available.'}

## Objectives
${list(report.objectives)}

## Work Completed
${list(report.work_completed)}

## Challenges
${list(report.challenges)}

## Learnings
${list(report.learnings)}

## Growth Summary
${report.growth_summary ?? 'Not available.'}

## Conclusion
${report.conclusion ?? 'Not available.'}

## Resume Bullets
${list(report.resume_bullets)}
`;
}

export function reportToHtml(report: InternshipReport, profile: Profile | null) {
  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { color: #111111; font-family: Arial, sans-serif; line-height: 1.55; padding: 32px; }
      h1 { font-size: 28px; margin-bottom: 6px; }
      h2 { border-bottom: 1px solid #E5E7EB; font-size: 18px; margin-top: 28px; padding-bottom: 6px; }
      p, li { font-size: 13px; }
      .meta { color: #6B7280; font-size: 12px; margin-bottom: 18px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(report.title)}</h1>
    <div class="meta">
      ${profile?.name ? `Prepared by ${escapeHtml(profile.name)}<br />` : ''}
      ${profile?.role ? `${escapeHtml(profile.role)}<br />` : ''}
      ${profile?.company ? `${escapeHtml(profile.company)}<br />` : ''}
      ${profile?.duration ? `${escapeHtml(profile.duration)}` : ''}
    </div>
    <h2>Introduction</h2>
    <p>${escapeHtml(report.introduction ?? 'Not available.')}</p>
    <h2>Objectives</h2>
    ${listHtml(report.objectives)}
    <h2>Work Completed</h2>
    ${listHtml(report.work_completed)}
    <h2>Challenges</h2>
    ${listHtml(report.challenges)}
    <h2>Learnings</h2>
    ${listHtml(report.learnings)}
    <h2>Growth Summary</h2>
    <p>${escapeHtml(report.growth_summary ?? 'Not available.')}</p>
    <h2>Conclusion</h2>
    <p>${escapeHtml(report.conclusion ?? 'Not available.')}</p>
    <h2>Resume Bullets</h2>
    ${listHtml(report.resume_bullets)}
  </body>
</html>
`;
}

export async function exportReportAsPdf(report: InternshipReport, profile: Profile | null) {
  const { uri } = await Print.printToFileAsync({
    html: reportToHtml(report, profile),
    base64: false,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      dialogTitle: 'Export Internship Report',
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    });
    return;
  }

  await Share.share({
    title: report.title,
    message: uri,
  });
}

export async function shareReportText(report: InternshipReport, profile: Profile | null) {
  await Share.share({
    title: report.title,
    message: reportToMarkdown(report, profile),
  });
}
