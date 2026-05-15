/**
 * Email template module — generates stunning HTML emails with plain text fallback
 * for the weekly job digest.
 *
 * ── UI/UX Pro Max Design System ─────────────────────────────────────────
 * Style:      Premium Editorial Minimalism
 * Palette:    Slate Navy primary · Amber accent · Emerald success · Blue info
 * Typography: Palatino (editorial headings) + System sans (UI)
 * Spacing:    8px/12px/16px/20px/24px/32px/40px/48px/56px rhythm
 * Icons:      Inline SVG + friendly emoji accents
 * ────────────────────────────────────────────────────────────────────────
 */

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
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

// ── Design Tokens ──────────────────────────────────────────────────────
// These are inlined as constants for email compatibility.
// Palette: Slate Navy · Amber · Emerald · Blue · Purple · Red

const TOKENS = {
  // Backgrounds
  bgPage:       '#f8fafc',
  bgHeader:     '#0b1120',
  bgCard:       '#ffffff',
  bgEmpty:      '#fef9e7',
  // Text
  textPrimary:  '#0f172a',
  textSecondary:'#475569',
  textMuted:    '#94a3b8',
  textInverse:  '#f1f5f9',
  // Borders
  borderCard:   '#e9edf2',
  borderLight:  '#f1f5f9',
  // Semantic
  accent:       '#f59e0b',
  accentDark:   '#d97706',
  success:      '#059669',
  successBg:    '#ecfdf5',
  info:         '#2563eb',
  infoBg:       '#eff6ff',
  warning:      '#d97706',
  warningBg:    '#fffbeb',
  danger:       '#dc2626',
  dangerBg:     '#fef2f2',
  profile:      '#7c3aed',
  profileBg:    '#f5f3ff',
  profileBorder:'#e9d5ff',
  // Effects
  shadow:       'rgba(15,23,42,0.06)',
  overlay:      'rgba(255,255,255,0.06)',
} as const;

// ── SVG Icons (inline, email-safe, no emojis) ──────────────────────────

const ICONS = {
  search: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${TOKENS.accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  briefcase: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${TOKENS.textMuted}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
  user: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${TOKENS.profile}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  star: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${TOKENS.accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  briefcaseFilled: `<svg width="22" height="22" viewBox="0 0 24 24" fill="${TOKENS.success}" stroke="${TOKENS.success}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
  starFilled: `<svg width="22" height="22" viewBox="0 0 24 24" fill="${TOKENS.info}" stroke="${TOKENS.info}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  trending: `<svg width="22" height="22" viewBox="0 0 24 24" fill="${TOKENS.warning}" stroke="${TOKENS.warning}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  external: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  check: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  location: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  dollar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  arrowRight: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
};

// ── Helper: score styling ──────────────────────────────────────────────

function scoreStyles(score: number) {
  if (score >= 80) return { color: TOKENS.success, bg: TOKENS.successBg, label: 'Excellent' };
  if (score >= 60) return { color: TOKENS.warning, bg: TOKENS.warningBg, label: 'Good' };
  return { color: TOKENS.danger, bg: TOKENS.dangerBg, label: 'Potential' };
}

// ── Font Stacks ────────────────────────────────────────────────────────

const FONT = {
  editorial: "'Palatino Linotype','Book Antiqua',Palatino,Georgia,'Times New Roman',serif",
  ui: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  mono: "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace",
};

// ── Inline Styles (email-safe patterns) ────────────────────────────────

const STYLES = {
  card: `background:${TOKENS.bgCard};border:1px solid ${TOKENS.borderCard};border-radius:12px;`,
  pill: (bg: string, color: string) => `background:${bg};color:${color};font-size:11px;font-weight:500;padding:4px 12px;border-radius:20px;margin:0 6px 6px 0;display:inline-block;font-family:${FONT.ui};`,
  badge: (bg: string, color: string) => `background:${bg};color:${color};font-size:10px;font-weight:700;padding:4px 10px;border-radius:6px;text-transform:uppercase;letter-spacing:0.5px;font-family:${FONT.ui};display:inline-block;`,
};

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

  const shortDate = new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // ── Shared header/footer HTML ─────────────────────────────────────────
  const headerOpen = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Job Digest</title>
</head>
<body style="margin:0;padding:0;background-color:${TOKENS.bgPage};font-family:${FONT.editorial};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${TOKENS.bgPage};">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">`;

  const headerClose = `</table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // ── Empty state ───────────────────────────────────────────────────────
  if (!jobs || jobs.length === 0) {
    return {
      html: `${headerOpen}
          <!-- ═══ HEADER ═══ -->
          <tr>
            <td style="background-color:#0b1120;background:linear-gradient(135deg,#0b1120,#1a2442);border-radius:16px 16px 0 0;padding:56px 32px 40px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="width:72px;height:72px;background:linear-gradient(135deg,${TOKENS.accent},${TOKENS.accentDark});border-radius:20px;text-align:center;vertical-align:middle;">
                    ${ICONS.search}
                  </td>
                </tr>
              </table>
              <h1 style="color:#ffffff;font-size:30px;font-weight:700;margin:0 0 8px;font-family:${FONT.editorial};letter-spacing:-0.5px;">📬 Weekly Job Digest</h1>
              <p style="color:${TOKENS.textMuted};font-size:14px;margin:0 0 28px;font-family:${FONT.ui};">📅 ${displayDate}</p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background:${TOKENS.overlay};border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 28px;">
                    <span style="color:${TOKENS.accent};font-size:16px;font-weight:600;font-family:${FONT.ui};">🔇 No new jobs at the moment</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- ═══ EMPTY BODY ═══ -->
          <tr>
            <td style="background:${TOKENS.bgCard};padding:56px 32px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                <tr>
                  <td style="width:96px;height:96px;background:${TOKENS.bgEmpty};border-radius:50%;text-align:center;vertical-align:middle;">
                    ${ICONS.briefcase}
                  </td>
                </tr>
              </table>
              <h2 style="color:${TOKENS.textPrimary};font-size:24px;font-weight:700;margin:0 0 12px;font-family:${FONT.editorial};">😔 No matching jobs found</h2>
              <p style="color:${TOKENS.textSecondary};font-size:15px;line-height:1.7;margin:0 0 4px;font-family:${FONT.ui};">Your search may be too specific, or fewer postings</p>
              <p style="color:${TOKENS.textSecondary};font-size:15px;line-height:1.7;margin:0 0 28px;font-family:${FONT.ui};">are available than usual. 🍀 Check back next week!</p>
            </td>
          </tr>
          <!-- ═══ FOOTER ═══ -->
          <tr>
            <td style="background-color:#0b1120;background:linear-gradient(135deg,#0b1120,#1a2442);border-radius:0 0 16px 16px;padding:28px 32px;text-align:center;">
              <p style="color:${TOKENS.textMuted};font-size:12px;margin:0;font-family:${FONT.ui};">Seahorse &mdash; Automated Job Matching Pipeline</p>
            </td>
          </tr>
${headerClose}`,
      text: `Weekly Job Digest — ${shortDate}\n\nNo matching jobs found for this week.\n\nBest regards,\nSeahorse — Job Email Automation`,
    };
  }

  // ── Sort and compute stats ────────────────────────────────────────────
  const sortedJobs = [...jobs].sort((a, b) => b.score - a.score);
  const totalJobs = sortedJobs.length;
  const avgScore = Math.round(sortedJobs.reduce((sum, j) => sum + j.score, 0) / totalJobs);
  const topScore = Math.round(sortedJobs[0].score);

  // ── Profile section HTML ──────────────────────────────────────────────
  const profileHtml = profile ? `
          <!-- ═══ PROFILE SECTION ═══ -->
          <tr>
            <td style="padding:0 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:${TOKENS.profileBg};border:1px solid ${TOKENS.profileBorder};border-radius:12px;margin-top:-12px;">
                <tr>
                  <td style="padding:24px 24px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <!-- Header -->
                      <tr>
                        <td style="padding-bottom:16px;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width:32px;height:32px;background:#ede9fe;border-radius:8px;text-align:center;vertical-align:middle;padding-right:10px;">
                                ${ICONS.user}
                              </td>
                              <td style="vertical-align:middle;">
                                <span style="color:${TOKENS.profile};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;font-family:${FONT.ui};">🙋 Your Profile</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      ${profile.jobTitles && profile.jobTitles.length > 0 ? `
                      <!-- Roles -->
                      <tr>
                        <td style="padding-bottom:10px;">
                          <table cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td width="72" style="color:#8b5cf6;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding-top:2px;font-family:${FONT.ui};">💼 Roles</td>
                              <td style="color:${TOKENS.textPrimary};font-size:15px;font-weight:600;font-family:${FONT.editorial};">${escapeHtml(profile.jobTitles.slice(0, 3).join(' · '))}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>` : ''}
                      ${profile.experienceLevel ? `
                      <!-- Level -->
                      <tr>
                        <td style="padding-bottom:10px;">
                          <table cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td width="72" style="color:#8b5cf6;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding-top:2px;font-family:${FONT.ui};">📈 Level</td>
                              <td style="color:${TOKENS.textSecondary};font-size:14px;font-family:${FONT.ui};">${escapeHtml(profile.experienceLevel.charAt(0).toUpperCase() + profile.experienceLevel.slice(1))}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>` : ''}
                      ${profile.locations && profile.locations.length > 0 ? `
                      <!-- Locations -->
                      <tr>
                        <td style="padding-bottom:10px;">
                          <table cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td width="72" style="color:#8b5cf6;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding-top:2px;font-family:${FONT.ui};">📍 Location</td>
                              <td style="color:${TOKENS.textSecondary};font-size:14px;font-family:${FONT.ui};">${escapeHtml(profile.locations.join(', '))}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>` : ''}
                      ${profile.skills && profile.skills.length > 0 ? `
                      <!-- Skills -->
                      <tr>
                        <td style="padding-top:6px;">
                          <table cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td width="72" style="color:#8b5cf6;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding-bottom:10px;font-family:${FONT.ui};">🔧 Skills</td>
                            </tr>
                          </table>
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              ${profile.skills.slice(0, 10).map(skill => `
                                <td style="${STYLES.pill('#ede9fe', TOKENS.profile)}">${escapeHtml(skill)}</td>
                              `).join('')}
                              ${profile.skills.length > 10 ? `<td style="color:${TOKENS.textSecondary};font-size:11px;padding-left:4px;font-family:${FONT.ui};">+${profile.skills.length - 10} more</td>` : ''}
                            </tr>
                          </table>
                        </td>
                      </tr>` : ''}
                      ${profile.languages && profile.languages.length > 0 ? `
                      <!-- Languages -->
                      <tr>
                        <td style="padding-top:14px;">
                          <table cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td width="72" style="color:#8b5cf6;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding-top:2px;font-family:${FONT.ui};">🗣️ Languages</td>
                              <td style="color:${TOKENS.textSecondary};font-size:13px;font-family:${FONT.ui};">${profile.languages.map(l => `<span style="font-weight:500;color:${TOKENS.textPrimary};">${l.language}</span> (${l.level})`).join(' · ')}</td>
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

  // ── Profile text (for plain text version) ────────────────────────────
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

  // ── Job cards HTML ───────────────────────────────────────────────────
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
    const sScore = scoreStyles(score);
    const salaryStr = job.salary ? `$${job.salary.toLocaleString()}` : null;
    const locationStr = job.location || 'Remote';

    jobsHtml += `
          <!-- Job Card ${index + 1} -->
          <tr>
            <td style="padding:6px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="${STYLES.card}">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <!-- Row 1: Source tag + Salary + Score badge -->
                      <tr>
                        <td style="padding-bottom:14px;">
                          <table cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td>
                                ${job.source ? `<table cellpadding="0" cellspacing="0" style="display:inline-block;margin-right:12px;"><tr><td style="${STYLES.badge('#f1f5f9', TOKENS.textSecondary)}">🌐 ${escapeHtml(job.source)}</td></tr></table>` : ''}
                                ${salaryStr ? `<span style="color:${TOKENS.success};font-size:13px;font-weight:700;font-family:${FONT.mono};">💰 ${escapeHtml(salaryStr)}</span>` : ''}
                              </td>
                              <td align="right">
                                <table cellpadding="0" cellspacing="0" style="background:${sScore.bg};border-radius:10px;">
                                  <tr>
                                    <td style="padding:6px 14px;">
                                      <table cellpadding="0" cellspacing="0">
                                        <tr>
                                          <td style="color:${sScore.color};font-size:18px;font-weight:800;font-family:${FONT.ui};">${Math.round(score)}</td>
                                          <td style="padding-left:4px;">
                                            <table cellpadding="0" cellspacing="0">
                                              <tr><td style="color:${sScore.color};font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;line-height:1.1;font-family:${FONT.ui};">🎯 match</td></tr>
                                              <tr><td style="color:${sScore.color};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;line-height:1.2;font-family:${FONT.ui};">${sScore.label}</td></tr>
                                            </table>
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
                      </tr>
                      <!-- Row 2: Title -->
                      <tr>
                        <td style="padding-bottom:8px;">
                          <h3 style="margin:0;font-size:17px;font-weight:700;line-height:1.3;font-family:${FONT.editorial};">
                            <a href="${escapeHtml(job.url)}" style="color:${TOKENS.textPrimary};text-decoration:none;">${escapeHtml(job.title)}</a>
                          </h3>
                        </td>
                      </tr>
                      <!-- Row 3: Company · Location -->
                      <tr>
                        <td style="padding-bottom:14px;">
                          <span style="color:${TOKENS.textSecondary};font-size:14px;font-weight:600;font-family:${FONT.ui};">🏢 ${escapeHtml(job.company)}</span>
                          <span style="color:#cbd5e1;padding:0 8px;">·</span>
                          <span style="color:${TOKENS.textMuted};font-size:14px;font-family:${FONT.ui};">📍 ${escapeHtml(locationStr)}</span>
                        </td>
                      </tr>
                      <!-- Row 4: Matched Skills -->
                      ${matchedSkills.length > 0 ? `
                      <tr>
                        <td style="padding-bottom:14px;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              ${matchedSkills.slice(0, 6).map(skill => `
                                <td style="${STYLES.pill('#eef2ff', '#4f46e5')}">${escapeHtml(skill)}</td>
                              `).join('')}
                              ${matchedSkills.length > 6 ? `<td style="color:${TOKENS.textMuted};font-size:11px;padding-left:4px;font-family:${FONT.ui};">+${matchedSkills.length - 6} more</td>` : ''}
                            </tr>
                          </table>
                        </td>
                      </tr>` : ''}
                      <!-- Row 5: Description -->
                      ${job.description ? `
                      <tr>
                        <td style="padding-bottom:16px;">
                          <p style="color:${TOKENS.textSecondary};font-size:13px;line-height:1.6;margin:0;font-family:${FONT.ui};">${escapeHtml(truncate(job.description, 200))}</p>
                        </td>
                      </tr>` : ''}
                      <!-- Row 6: CTA -->
                      <tr>
                        <td>
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background-color:#1e293b;background:linear-gradient(135deg,#1e293b,#334155);border-radius:10px;">
                                <a href="${escapeHtml(job.url)}" style="display:block;padding:11px 28px;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;font-family:${FONT.ui};">
                                  🚀 View Job &nbsp;${ICONS.external}
                                </a>
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
    textLines.push(`   Match: ${Math.round(score)}% · Skills: ${matchedSkills.join(', ')}`);
    textLines.push('');
  });

  textLines.push('───');
  textLines.push('Seahorse — Automated Job Matching Pipeline');

  return {
    html: `${headerOpen}

          <!-- ═══ HEADER ═══ -->
          <tr>
            <td style="background-color:#0b1120;background:linear-gradient(135deg,#0b1120,#1a2442,#0b1120);border-radius:16px 16px 0 0;padding:56px 32px 36px;text-align:center;">
              <!-- Icon Badge -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="width:72px;height:72px;background-color:${TOKENS.accentDark};background:linear-gradient(135deg,${TOKENS.accent},${TOKENS.accentDark});border-radius:20px;text-align:center;vertical-align:middle;box-shadow:0 8px 24px rgba(245,158,11,0.2);">
                    ${ICONS.search}
                  </td>
                </tr>
              </table>
              <!-- Title -->
              <h1 style="color:#ffffff;font-size:30px;font-weight:700;margin:0 0 6px;font-family:${FONT.editorial};letter-spacing:-0.5px;">📬 Weekly Job Digest</h1>
              <p style="color:${TOKENS.textMuted};font-size:14px;margin:0 0 28px;font-family:${FONT.ui};">📅 ${displayDate}</p>
              <!-- Header Stats Bar -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;background:${TOKENS.overlay};border:1px solid rgba(255,255,255,0.06);border-radius:14px;">
                <tr>
                  <td style="padding:16px 24px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:0 20px;text-align:center;min-width:80px;">
                          <div style="color:#ffffff;font-size:28px;font-weight:800;font-family:${FONT.ui};">${totalJobs}</div>
                          <div style="color:${TOKENS.textMuted};font-size:10px;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;padding-top:2px;font-family:${FONT.ui};">📊 Jobs</div>
                        </td>
                        <td style="width:1px;height:44px;background:rgba(255,255,255,0.06);"></td>
                        <td style="padding:0 20px;text-align:center;min-width:80px;">
                          <div style="color:#34d399;font-size:28px;font-weight:800;font-family:${FONT.ui};">${avgScore}<span style="font-size:16px;">%</span></div>
                          <div style="color:${TOKENS.textMuted};font-size:10px;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;padding-top:2px;font-family:${FONT.ui};">⭐ Avg</div>
                        </td>
                        <td style="width:1px;height:44px;background:rgba(255,255,255,0.06);"></td>
                        <td style="padding:0 20px;text-align:center;min-width:80px;">
                          <div style="color:#fbbf24;font-size:28px;font-weight:800;font-family:${FONT.ui};">${topScore}<span style="font-size:16px;">%</span></div>
                          <div style="color:${TOKENS.textMuted};font-size:10px;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;padding-top:2px;font-family:${FONT.ui};">🏆 Best</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${profileHtml}

          <!-- ═══ BODY ═══ -->
          <tr>
            <td style="background:${TOKENS.bgCard};padding:28px 0 8px;">

              <!-- Stats Cards Row -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 24px 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="33%" style="padding:0 6px;">
                          <table cellpadding="0" cellspacing="0" style="background:${TOKENS.successBg};border-radius:14px;width:100%;">
                            <tr><td align="center" style="padding:18px 12px 6px;">${ICONS.briefcaseFilled}</td></tr>
                            <tr><td align="center" style="color:${TOKENS.success};font-size:26px;font-weight:800;padding:4px 12px 0;font-family:${FONT.ui};">${totalJobs}</td></tr>
                            <tr><td align="center" style="color:#6b7280;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;padding:4px 12px 18px;font-family:${FONT.ui};">📋 Jobs Found</td></tr>
                          </table>
                        </td>
                        <td width="33%" style="padding:0 6px;">
                          <table cellpadding="0" cellspacing="0" style="background:${TOKENS.infoBg};border-radius:14px;width:100%;">
                            <tr><td align="center" style="padding:18px 12px 6px;">${ICONS.starFilled}</td></tr>
                            <tr><td align="center" style="color:${TOKENS.info};font-size:26px;font-weight:800;padding:4px 12px 0;font-family:${FONT.ui};">${avgScore}<span style="font-size:16px;">%</span></td></tr>
                            <tr><td align="center" style="color:#6b7280;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;padding:4px 12px 18px;font-family:${FONT.ui};">🎯 Avg Match</td></tr>
                          </table>
                        </td>
                        <td width="33%" style="padding:0 6px;">
                          <table cellpadding="0" cellspacing="0" style="background:${TOKENS.warningBg};border-radius:14px;width:100%;">
                            <tr><td align="center" style="padding:18px 12px 6px;">${ICONS.trending}</td></tr>
                            <tr><td align="center" style="color:${TOKENS.warning};font-size:26px;font-weight:800;padding:4px 12px 0;font-family:${FONT.ui};">${topScore}<span style="font-size:16px;">%</span></td></tr>
                            <tr><td align="center" style="color:#6b7280;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;padding:4px 12px 18px;font-family:${FONT.ui};">🔥 Best Match</td></tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Gradient Divider -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="height:1px;background:linear-gradient(to right,transparent,${TOKENS.borderCard},transparent);"></td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Section: Matched Jobs -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:24px 24px 4px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align:middle;padding-right:10px;">${ICONS.star}</td>
                        <td style="vertical-align:middle;">
                          <h2 style="color:#0f172a;font-size:19px;font-weight:700;margin:0;font-family:${FONT.editorial};">💼 Matched Jobs</h2>
                        </td>
                      </tr>
                    </table>
                    <p style="color:${TOKENS.textMuted};font-size:13px;margin:10px 0 0;font-family:${FONT.ui};">📊 Sorted by match score — highest first</p>
                  </td>
                </tr>
              </table>

              ${jobsHtml}

              <!-- Bottom spacer -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="height:32px;"></td></tr>
              </table>

            </td>
          </tr>

          <!-- ═══ FOOTER ═══ -->
          <tr>
            <td style="background-color:#0b1120;background:linear-gradient(135deg,#0b1120,#1a2442);border-radius:0 0 16px 16px;padding:36px 32px;text-align:center;">
              <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 12px;font-family:${FONT.ui};">
                ✉️ You're receiving this because you subscribed to
              </p>
              <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0 0 20px;font-family:${FONT.ui};">
                job alerts from Seahorse 🐴💨
              </p>
              <!-- Decorative divider -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 20px;">
                <tr>
                  <td style="width:40px;height:2px;background:linear-gradient(to right,${TOKENS.accent},${TOKENS.accentDark});border-radius:2px;"></td>
                </tr>
              </table>
              <p style="color:${TOKENS.textMuted};font-size:12px;margin:0;font-family:${FONT.ui};">Seahorse &mdash; Automated Job Matching Pipeline</p>
            </td>
          </tr>

${headerClose}`,
    text: textLines.join('\n'),
  };
}
