// ***********************************************
// Custom Cypress Commands
// ***********************************************

// ──────────────────────────────────────────────
// Seed data helpers
// ──────────────────────────────────────────────

/**
 * Seed mock dashboard stats
 */
Cypress.Commands.add('seedDashboardStats', () => {
  cy.intercept('GET', '/api/stats', {
    statusCode: 200,
    body: {
      totalJobs: 47,
      todayJobs: 5,
      matches: 12,
      matchRate: 25.5,
      trend: [10, 15, 12, 18, 14, 20, 22],
      topSkills: ['TypeScript', 'React', 'Node.js', 'Python', 'AWS'],
      recentMatches: [
        {
          id: '1',
          title: 'Senior Frontend Developer',
          company: 'TechCorp',
          score: 92,
          location: 'Remote',
          salary: '$120k-$150k',
          url: 'https://example.com/job/1',
          matchedAt: new Date().toISOString(),
        },
        {
          id: '2',
          title: 'Full Stack Engineer',
          company: 'StartupXYZ',
          score: 78,
          location: 'San Francisco, CA',
          salary: '$130k-$160k',
          url: 'https://example.com/job/2',
          matchedAt: new Date().toISOString(),
        },
        {
          id: '3',
          title: 'React Developer',
          company: 'WebAgency',
          score: 65,
          location: 'Remote',
          salary: '$100k-$130k',
          url: 'https://example.com/job/3',
          matchedAt: new Date().toISOString(),
        },
      ],
    },
  }).as('getStats')
})

/**
 * Seed mock matched jobs
 */
Cypress.Commands.add('seedJobs', () => {
  const jobs = [
    {
      id: '1',
      title: 'Senior Frontend Developer',
      company: 'TechCorp',
      location: 'Remote',
      salary: '$120k-$150k',
      url: 'https://example.com/job/1',
      source: 'JSearch',
      postedAt: new Date().toISOString(),
      matchScore: 92,
      scoreBreakdown: {
        skills: 38,
        interests: 28,
        location: 18,
        salary: 8,
      },
    },
    {
      id: '2',
      title: 'Full Stack Engineer',
      company: 'StartupXYZ',
      location: 'San Francisco, CA',
      salary: '$130k-$160k',
      url: 'https://example.com/job/2',
      source: 'Computrabajo',
      postedAt: new Date(Date.now() - 86400000).toISOString(),
      matchScore: 78,
      scoreBreakdown: {
        skills: 32,
        interests: 24,
        location: 14,
        salary: 8,
      },
    },
    {
      id: '3',
      title: 'React Developer',
      company: 'WebAgency',
      location: 'Remote',
      salary: '$100k-$130k',
      url: 'https://example.com/job/3',
      source: 'Indeed',
      postedAt: new Date(Date.now() - 172800000).toISOString(),
      matchScore: 65,
      scoreBreakdown: {
        skills: 28,
        interests: 20,
        location: 12,
        salary: 5,
      },
    },
    {
      id: '4',
      title: 'Backend Developer (Node.js)',
      company: 'CloudScale',
      location: 'New York, NY',
      salary: '$140k-$170k',
      url: 'https://example.com/job/4',
      source: 'Glassdoor',
      postedAt: new Date(Date.now() - 259200000).toISOString(),
      matchScore: 45,
      scoreBreakdown: {
        skills: 18,
        interests: 12,
        location: 10,
        salary: 5,
      },
    },
    {
      id: '5',
      title: 'Junior Web Developer',
      company: 'DigitalLab',
      location: 'Miami, FL',
      salary: '$70k-$90k',
      url: 'https://example.com/job/5',
      source: 'Computrabajo',
      postedAt: new Date(Date.now() - 345600000).toISOString(),
      matchScore: 35,
      scoreBreakdown: {
        skills: 14,
        interests: 10,
        location: 8,
        salary: 3,
      },
    },
  ]

  cy.intercept('GET', '/api/match-jobs*', {
    statusCode: 200,
    body: { jobs, total: jobs.length },
  }).as('getJobs')
})

/**
 * Seed empty jobs (no matches)
 */
Cypress.Commands.add('seedEmptyJobs', () => {
  cy.intercept('GET', '/api/match-jobs*', {
    statusCode: 200,
    body: { jobs: [], total: 0 },
  }).as('getEmptyJobs')
})

/**
 * Seed pipeline status
 */
Cypress.Commands.add('seedPipelineStatus', (status: string) => {
  const statusMap: Record<string, any> = {
    idle: {
      status: 'idle',
      steps: [
        { name: 'scraping', label: 'Scraping', status: 'pending' },
        { name: 'matching', label: 'Matching', status: 'pending' },
        { name: 'completion', label: 'Completion', status: 'pending' },
      ],
    },
    running: {
      status: 'running',
      steps: [
        { name: 'scraping', label: 'Scraping', status: 'running', progress: 60 },
        { name: 'matching', label: 'Matching', status: 'pending' },
        { name: 'completion', label: 'Completion', status: 'pending' },
      ],
      logs: [
        '🚀 Starting pipeline...',
        '📡 Scraping job boards...',
        '  ✓ JSearch API returned 10 jobs',
        '  ✓ Computrabajo returned 8 jobs',
        '⏳ Still scraping...',
      ],
    },
    completed: {
      status: 'completed',
      steps: [
        { name: 'scraping', label: 'Scraping', status: 'done' },
        { name: 'matching', label: 'Matching', status: 'done' },
        { name: 'completion', label: 'Completion', status: 'done' },
      ],
      logs: [
        '🚀 Starting pipeline...',
        '📡 Scraping job boards...',
        '  ✓ JSearch API returned 10 jobs',
        '  ✓ Computrabajo returned 8 jobs',
        '  ✓ Indeed returned 3 jobs',
        '  ✓ Glassdoor returned 2 jobs',
        '✅ Scraping complete — 23 jobs found',
        '🎯 Matching jobs against profile...',
        '  ✓ Matched 23/23 jobs',
        '✅ Matching complete — 12 high-quality matches',
        '📧 Sending email digest...',
        '  ✓ Email sent to recipient',
        '✅ Pipeline completed successfully!',
      ],
      result: {
        totalJobs: 23,
        matches: 12,
        topMatch: 92,
        avgScore: 68,
        emailSent: true,
      },
    },
    error: {
      status: 'error',
      steps: [
        { name: 'scraping', label: 'Scraping', status: 'error', error: 'Failed to connect to JSearch API' },
        { name: 'matching', label: 'Matching', status: 'pending' },
        { name: 'completion', label: 'Completion', status: 'pending' },
      ],
      logs: [
        '🚀 Starting pipeline...',
        '📡 Scraping job boards...',
        '  ✗ JSearch API: Network error (timeout)',
        '❌ Pipeline failed at Scraping step',
      ],
    },
  }

  cy.intercept('GET', '/api/pipeline/status', {
    statusCode: 200,
    body: statusMap[status] || statusMap.idle,
  }).as('getPipelineStatus')
})

/**
 * Seed profile data for settings page
 */
Cypress.Commands.add('seedProfile', () => {
  cy.intercept('GET', '/api/profile/history', {
    statusCode: 200,
    body: {
      profile: {
        title: 'Senior Frontend Developer',
        skills: ['TypeScript', 'React', 'Node.js', 'CSS', 'GraphQL'],
        experience: '5+ years',
        location: 'Remote',
        salary_min: 120000,
        salary_max: 150000,
        remote: true,
        interests: ['Web Development', 'SaaS', 'AI/ML'],
        languages: ['English', 'Spanish'],
      },
    },
  }).as('getProfile')
})

/**
 * Seed config/API keys
 */
Cypress.Commands.add('seedApiKeys', () => {
  cy.intercept('GET', '/api/config/keys', {
    statusCode: 200,
    body: {
      keys: {
        JSEARCH_API_KEY: 'demo-key-12345',
        GEMINI_API_KEY: 'demo-gemini-key',
        OPENAI_API_KEY: '',
      },
    },
  }).as('getApiKeys')
})

/**
 * Navigate to a page and wait for it to load
 */
Cypress.Commands.add('navigateTo', (route: string) => {
  cy.visit(route)
  cy.waitForPageLoad()
})

/**
 * Wait for the page to be fully loaded (animations, network idle)
 */
Cypress.Commands.add('waitForPageLoad', () => {
  cy.get('body', { timeout: 15000 }).should('be.visible')
  // Wait for at least one data-testid element to render (confirms React components are mounted)
  cy.get('[data-testid]', { timeout: 10000 }).should('have.length.at.least', 1)
})

/**
 * Check that a toast notification appears
 */
Cypress.Commands.add('checkToast', (message: string) => {
  cy.contains(message, { timeout: 8000 }).should('be.visible')
})

// ──────────────────────────────────────────────
// Type declarations for custom commands
// ──────────────────────────────────────────────
declare global {
  namespace Cypress {
    interface Chainable {
      seedDashboardStats(): Chainable<void>
      seedJobs(): Chainable<void>
      seedEmptyJobs(): Chainable<void>
      seedPipelineStatus(status: string): Chainable<void>
      seedProfile(): Chainable<void>
      seedApiKeys(): Chainable<void>
      navigateTo(route: string): Chainable<void>
      waitForPageLoad(): Chainable<void>
      checkToast(message: string): Chainable<void>
    }
  }
}

export {}
