/**
 * Email template module — generates stunning HTML emails with plain text fallback
 * for the weekly job digest. Designed with premium editorial aesthetic.
 */

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Truncate text to max length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).replace(/\s+\S*$/, '') + '…';
}

export interface JobDigestItem {
  job: {
    title: string;
    company: string;
    location?: string | null;
    description?: string | null;
    url: string;
    salary?: number | null;
    source?: string;
  };
  score: number;
  matchedSkills: string[];
}

export interface ProfileInfo {
  jobTitles?: string[];
  skills?: string[];
  locations?: string[];
  experienceLevel?: string;
  summary?: string;
  languages?: { language: string; level: string }[];
}

/**
 * Format a job digest email with both HTML and plain text versions.
 * @param jobs Array of jobs with match scores
 * @param date Date string for email header
 * @param profile Optional extracted profile for personalization
 * @returns Object with `html` and `text` properties
 */
export function formatJobDigest(
  jobs: JobDigestItem[],
  date: string = new Date().toISOString(),
  profile?: ProfileInfo
): { html: string; text: string } {
  const displayDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (!jobs || jobs.length === 0) {
    return {
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Job Digest</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#0a0e27 0%,#1a1040 50%,#162447 100%);border-radius:20px 20px 0 0;padding:48px 30px 36px;text-align:center;">
              <div style="width:64px;height:64px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:16px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:32px;line-height:64px;">🔍</span>
              </div>
              <h1 style="color:#ffffff;font-size:30px;font-weight:700;margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;letter-spacing:-0.5px;">Weekly Job Digest</h1>
              <p style="color:#8b8fa3;font-size:15px;margin:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${displayDate}</p>
              <div style="display:inline-block;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px 24px;">
                <span style="color:#ffffff;font-size:14px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">No new jobs this week</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;padding:48px 30px;text-align:center;">
              <div style="width:80px;height:80px;background:#fef3c7;border-radius:50%;margin:0 auto 24px;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:36px;">📭</span>
              </div>
              <h2 style="color:#1a202c;font-size:22px;font-weight:700;margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;">No jobs found this week</h2>
              <p style="color:#718096;font-size:16px;line-height:1.7;margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Your search may be too specific, or there are fewer</p>
              <p style="color:#718096;font-size:16px;line-height:1.7;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">postings than usual. Check back next week!</p>
            </td>
          </tr>
          <tr>
            <td style="background:linear-gradient(135deg,#0a0e27 0%,#1a1040 100%);border-radius:0 0 20px 20px;padding:24px 30px;text-align:center;">
              <p style="color:#6b7280;font-size:13px;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Seahorse — Automated Job Matching Pipeline</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      text: `Weekly Job Digest - ${date}\n\nNo new jobs found for this week.\n\nBest regards,\nSeahorse — Job Email Automation`,
    };
  }

  const sortedJobs = [...jobs].sort((a, b) => b.score - a.score);
  const totalJobs = sortedJobs.length;
  const avgScore = Math.round(sortedJobs.reduce((sum, j) => sum + j.score, 0) / totalJobs);
  const topScore = Math.round(sortedJobs[0].score);

  // ── Profile section text ─────────────────────────────────────────────────
  const profileTextLines: string[] = [];
  if (profile) {
    if (profile.jobTitles && profile.jobTitles.length > 0) {
      profileTextLines.push(`Target Roles: ${profile.jobTitles.slice(0, 3).join(', ')}`);
    }
    if (profile.skills && profile.skills.length > 0) {
      profileTextLines.push(`Key Skills: ${profile.skills.slice(0, 8).join(', ')}`);
    }
    if (profile.locations && profile.locations.length > 0) {
      profileTextLines.push(`Preferred Locations: ${profile.locations.join(', ')}`);
    }
    if (profile.experienceLevel) {
      profileTextLines.push(`Experience Level: ${profile.experienceLevel.charAt(0).toUpperCase() + profile.experienceLevel.slice(1)}`);
    }
    if (profile.summary) {
      profileTextLines.push(`Summary: ${profile.summary}`);
    }
  }

  // ── Build profile section HTML ─────────────────────────────────────────────
  const profileHtml = profile ? `
          <tr>
            <td style="padding:0 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:16px;margin-top:-12px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom:16px;">
                          <span style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#ffffff;font-size:10px;font-weight:700;padding:4px 14px;border-radius:20px;text-transform:uppercase;letter-spacing:0.8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">🎯 Your Profile</span>
                        </td>
                      </tr>
                      ${profile.jobTitles && profile.jobTitles.length > 0 ? `
                      <tr>
                        <td style="padding-bottom:10px;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color:#6b7280;font-size:12px;font-weight:600;padding-right:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">ROLES</td>
                              <td style="color:#1f2937;font-size:14px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${escapeHtml(profile.jobTitles.slice(0, 3).join(' · '))}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>` : ''}
                      ${profile.experienceLevel ? `
                      <tr>
                        <td style="padding-bottom:10px;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color:#6b7280;font-size:12px;font-weight:600;padding-right:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">LEVEL</td>
                              <td style="color:#4b5563;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${escapeHtml(profile.experienceLevel.charAt(0).toUpperCase() + profile.experienceLevel.slice(1))}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>` : ''}
                      ${profile.locations && profile.locations.length > 0 ? `
                      <tr>
                        <td style="padding-bottom:10px;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color:#6b7280;font-size:12px;font-weight:600;padding-right:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">LOCATION</td>
                              <td style="color:#4b5563;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${escapeHtml(profile.locations.join(', '))}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>` : ''}
                      ${profile.skills && profile.skills.length > 0 ? `
                      <tr>
                        <td style="padding-top:4px;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color:#6b7280;font-size:12px;font-weight:600;padding-right:8px;padding-bottom:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">SKILLS</td>
                            </tr>
                          </table>
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              ${profile.skills.slice(0, 7).map(skill => `
                                <td style="background:#ede9fe;color:#6d28d9;font-size:11px;font-weight:500;padding:3px 10px;border-radius:12px;margin:0 4px 4px 0;display:inline-block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${escapeHtml(skill)}</td>
                              `).join('')}
                              ${profile.skills.length > 7 ? `<td style="color:#6b7280;font-size:11px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">+${profile.skills.length - 7} more</td>` : ''}
                            </tr>
                          </table>
                        </td>
                      </tr>` : ''}
                      ${profile.languages && profile.languages.length > 0 ? `
                      <tr>
                        <td style="padding-top:10px;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color:#6b7280;font-size:12px;font-weight:600;padding-right:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">LANGUAGES</td>
                              <td style="color:#4b5563;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${profile.languages.map(l => `${l.language} (${l.level})`).join(' · ')}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : '';

  // ── Build job cards HTML ─────────────────────────────────────────────────
  let jobsHtml = '';
  const textLines: string[] = [
    `Weekly Job Digest — ${displayDate}`,
    '',
    ...(profileTextLines.length > 0 ? ['YOUR PROFILE', '─'.repeat(40), ...profileTextLines, '', '─'.repeat(40), ''] : []),
    `We found ${totalJobs} matching jobs for you:`,
    '',
  ];

  sortedJobs.forEach((jobItem, index) => {
    const { job, score, matchedSkills } = jobItem;
    const scoreColor = score >= 80 ? '#059669' : score >= 60 ? '#d97706' : '#dc2626';
    const scoreBgColor = score >= 80 ? '#ecfdf5' : score >= 60 ? '#fffbeb' : '#fef2f2';
    const scoreLabel = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Potential';
    const salaryStr = job.salary ? `$${job.salary.toLocaleString()}` : null;
    const locationStr = job.location || 'Remote';

    jobsHtml += `
          <tr>
            <td style="padding:6px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 1px 3px rgba(0,0,0,0.03);">
                <tr>
                  <td style="padding:22px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">

                      <!-- Source & Salary Row -->
                      <tr>
                        <td style="padding-bottom:8px;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              ${job.source ? `<td style="background:#f3f4f6;color:#6b7280;font-size:10px;font-weight:600;padding:3px 10px;border-radius:6px;text-transform:uppercase;letter-spacing:0.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${escapeHtml(job.source)}</td>` : ''}
                              ${salaryStr ? `<td style="padding-left:${job.source ? '10' : '0'}px;"><span style="color:#059669;font-size:13px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${escapeHtml(salaryStr)}</span></td>` : ''}
                              ${job.source || salaryStr ? '' : '<td></td>'}
                              <td align="right" style="width:100%;">
                                <table cellpadding="0" cellspacing="0" style="background:${scoreBgColor};border-radius:8px;padding:4px 12px;display:inline-block;">
                                  <tr>
                                    <td style="color:${scoreColor};font-size:15px;font-weight:800;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${Math.round(score)}%</td>
                                    <td style="color:${scoreColor};font-size:10px;font-weight:600;padding-left:4px;opacity:0.7;text-transform:uppercase;letter-spacing:0.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">match</td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Title -->
                      <tr>
                        <td style="padding-bottom:6px;">
                          <h3 style="margin:0;font-size:18px;font-weight:700;line-height:1.3;">
                            <a href="${escapeHtml(job.url)}" style="color:#111827;text-decoration:none;">${escapeHtml(job.title)}</a>
                          </h3>
                        </td>
                      </tr>

                      <!-- Company & Location -->
                      <tr>
                        <td style="padding-bottom:14px;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color:#374151;font-size:14px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${escapeHtml(job.company)}</td>
                              <td style="padding:0 8px;color:#d1d5db;">·</td>
                              <td style="color:#6b7280;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${escapeHtml(locationStr)}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- Skills -->
                      ${matchedSkills.length > 0 ? `
                      <tr>
                        <td style="padding-bottom:14px;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              ${matchedSkills.slice(0, 6).map(skill => `
                                <td style="background:#eff6ff;color:#2563eb;font-size:11px;font-weight:500;padding:4px 12px;border-radius:20px;margin:0 4px 4px 0;display:inline-block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${escapeHtml(skill)}</td>
                              `).join('')}
                              ${matchedSkills.length > 6 ? `<td style="color:#6b7280;font-size:11px;padding-left:2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">+${matchedSkills.length - 6}</td>` : ''}
                            </tr>
                          </table>
                        </td>
                      </tr>` : ''}

                      <!-- Description -->
                      ${job.description ? `
                      <tr>
                        <td style="padding-bottom:14px;">
                          <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${escapeHtml(truncate(job.description, 180))}</p>
                        </td>
                      </tr>` : ''}

                      <!-- CTA Button -->
                      <tr>
                        <td>
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td>
                                <a href="${escapeHtml(job.url)}" style="display:inline-block;background:linear-gradient(135deg,#111827,#1f2937);color:#ffffff;font-size:13px;font-weight:600;padding:10px 22px;border-radius:10px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Apply Now →</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;

    // Plain text
    textLines.push(`${index + 1}. ${job.title} at ${job.company} — ${locationStr}`);
    textLines.push(`   ${job.url}`);
    textLines.push(`   Match: ${Math.round(score)}% | Skills: ${matchedSkills.join(', ')}`);
    textLines.push('');
  });

  textLines.push('───');
  textLines.push(`Sent by Seahorse — Automated Job Matching Pipeline`);

  return {
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Job Digest</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:Georgia,'Times New Roman',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- ═══ HEADER ═══ -->
          <tr>
            <td style="background:linear-gradient(135deg,#0a0e27 0%,#1a1040 50%,#162447 100%);border-radius:20px 20px 0 0;padding:48px 30px 32px;text-align:center;">
              <div style="width:64px;height:64px;background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:16px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:32px;line-height:64px;">🔍</span>
              </div>
              <h1 style="color:#ffffff;font-size:30px;font-weight:700;margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;letter-spacing:-0.5px;">Weekly Job Digest</h1>
              <p style="color:#8b8fa3;font-size:15px;margin:0 0 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${displayDate}</p>
              <div style="display:inline-block;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px 24px;">
                <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                  <tr>
                    <td style="padding:0 12px;text-align:center;">
                      <div style="color:#ffffff;font-size:22px;font-weight:800;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${totalJobs}</div>
                      <div style="color:#8b8fa3;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Jobs</div>
                    </td>
                    <td style="width:1px;height:36px;background:rgba(255,255,255,0.08);"></td>
                    <td style="padding:0 12px;text-align:center;">
                      <div style="color:#10b981;font-size:22px;font-weight:800;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${avgScore}%</div>
                      <div style="color:#8b8fa3;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Avg Match</div>
                    </td>
                    <td style="width:1px;height:36px;background:rgba(255,255,255,0.08);"></td>
                    <td style="padding:0 12px;text-align:center;">
                      <div style="color:#f59e0b;font-size:22px;font-weight:800;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${topScore}%</div>
                      <div style="color:#8b8fa3;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Best</div>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- ═══ PROFILE SECTION ═══ -->
          ${profileHtml}

          <!-- ═══ STATS RIBBON ═══ -->
          <tr>
            <td style="background:#ffffff;padding:28px 20px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33%" align="center" style="padding:0 6px;">
                    <table cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:14px;padding:18px 12px;width:100%;">
                      <tr><td align="center" style="color:#059669;font-size:26px;font-weight:800;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${totalJobs}</td></tr>
                      <tr><td align="center" style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;padding-top:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Jobs Found</td></tr>
                    </table>
                  </td>
                  <td width="33%" align="center" style="padding:0 6px;">
                    <table cellpadding="0" cellspacing="0" style="background:#eff6ff;border-radius:14px;padding:18px 12px;width:100%;">
                      <tr><td align="center" style="color:#2563eb;font-size:26px;font-weight:800;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${avgScore}%</td></tr>
                      <tr><td align="center" style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;padding-top:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Avg Match</td></tr>
                    </table>
                  </td>
                  <td width="33%" align="center" style="padding:0 6px;">
                    <table cellpadding="0" cellspacing="0" style="background:#fffbeb;border-radius:14px;padding:18px 12px;width:100%;">
                      <tr><td align="center" style="color:#d97706;font-size:26px;font-weight:800;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${topScore}%</td></tr>
                      <tr><td align="center" style="color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;padding-top:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Best Match</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ═══ DIVIDER ═══ -->
          <tr>
            <td style="background:#ffffff;padding:0 20px;">
              <div style="height:1px;background:#e5e7eb;width:100%;"></div>
            </td>
          </tr>

          <!-- ═══ JOBS HEADER ═══ -->
          <tr>
            <td style="background:#ffffff;padding:20px 20px 4px;">
              <h2 style="color:#111827;font-size:18px;font-weight:700;margin:0;font-family:Georgia,'Times New Roman',serif;">Matched Jobs</h2>
              <p style="color:#6b7280;font-size:13px;margin:4px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Sorted by match score — highest first</p>
            </td>
          </tr>

          <!-- ═══ JOB CARDS ═══ -->
          ${jobsHtml}

          <!-- ═══ SPACER ═══ -->
          <tr>
            <td style="background:#ffffff;height:24px;"></td>
          </tr>

          <!-- ═══ FOOTER ═══ -->
          <tr>
            <td style="background:linear-gradient(135deg,#0a0e27 0%,#1a1040 100%);border-radius:0 0 20px 20px;padding:32px 30px;text-align:center;">
              <p style="color:#8b8fa3;font-size:13px;line-height:1.7;margin:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                You're receiving this because you subscribed to job alerts from Seahorse.
              </p>
              <p style="color:#6b7280;font-size:12px;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                Seahorse — Automated Job Matching Pipeline
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    text: textLines.join('\n'),
  };
}
