import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 30000,
    video: true,
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    fixturesFolder: 'cypress/fixtures',
    trashAssetsBeforeRuns: true,
    watchForFileChanges: false,
    experimentalRunAllSpecs: true,
    setupNodeEvents(on, config) {
      // Register event listeners here if needed
      on('task', {
        log(message) {
          console.log(message)
          return null
        },
      })
    },
  },
})
