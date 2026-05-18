# Project: Job Offer Email Automation

**Generated:** 2026-03-25  
**Status:** Initialization

## Core Value

Automated system that scrapes major job boards weekly, filters jobs using AI matching, and sends personalized email digests with new job opportunities.

## Problem Statement

Job seekers need to check multiple job boards frequently to find relevant opportunities. Manual checking is time-consuming and easy to miss good opportunities. This system automates the discovery and notification process.

## Solution Overview

A Node.js application that:

- Scrapes major job boards (LinkedIn, Indeed, Glassdoor, etc.)
- Uses AI to match jobs against user's skills/interests
- Sends weekly email digests via Gmail
- Runs on GitHub Actions schedule

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Scrape job listings from major job boards
- [ ] AI-powered job matching based on user profile
- [ ] Weekly scheduled execution
- [ ] Email delivery via Gmail API
- [ ] Simple text email format with job links
- [ ] Personal use (single user)

### Out of Scope

- Multi-user support — Focus on personal use first
- Real-time notifications — Weekly digest is sufficient
- Rich HTML emails — Simple text format preferred

## Key Decisions

| Decision             | Rationale                                    | Outcome                                    |
| -------------------- | -------------------------------------------- | ------------------------------------------ |
| Programming Language | Strong ecosystem for scraping and automation | Node.js with TypeScript                    |
| Email Service        | User already has Gmail                       | Gmail API                                  |
| Scheduling           | Free, reliable, integrates with GitHub       | GitHub Actions (weekly)                    |
| Job Sources          | Most comprehensive job listings              | Major boards (LinkedIn, Indeed, Glassdoor) |
| Filtering            | Better than keyword matching                 | AI-powered matching                        |

## Constraints

- **Budget:** Prefer free tiers (GitHub Actions, Gmail free tier)
- **Timeline:** Quick to market, iterate based on usage
- **Technical:** Must handle anti-scraping measures on job boards

## Success Metrics

- [ ] Successfully scrapes 3+ job boards
- [ ] AI matching produces relevant results (>70% relevance)
- [ ] Weekly emails delivered reliably
- [ ] User finds at least one relevant job per month

---

_Last updated: 2026-03-25 after initialization_
