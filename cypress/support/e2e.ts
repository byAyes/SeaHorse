// ***********************************************************
// This support file is processed and loaded automatically 
// before each test file.
// ***********************************************************

import './commands'

// Prevent uncaught exceptions from failing tests when
// dealing with external resources or framer-motion animations
Cypress.on('uncaught:exception', (err) => {
  // Ignore ResizeObserver errors from animation libraries
  if (
    err.message.includes('ResizeObserver') ||
    err.message.includes('ResizeObserver loop limit exceeded')
  ) {
    return false
  }
  // Ignore framer-motion errors
  if (err.message.includes('framer-motion') || err.message.includes('motion')) {
    return false
  }
  // Ignore Next.js router errors
  if (err.message.includes('next/router') || err.message.includes('next/navigation')) {
    return false
  }
})
