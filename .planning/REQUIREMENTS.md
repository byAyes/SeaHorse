# GSD Requirements: Automation CV Web Portal

## Overview
Expand existing job-email-automation to add CV web portal while keeping weekly emails.

## Requirements

### P0 (MUST)
- [x] Frontend HTML page for CV upload/form
- [x] CV parsing (extract name, email, skills from PDF/DOCX)
- [x] Manual job filtering UI (search/filters)
- [x] Keep existing weekly email automation
- [x] Gmail OAuth2 configured and working
- [x] Pipeline ejecutable sin base de datos externa (almacenamiento local JSON)

### P1 (SHOULD)
- [x] Display scraped jobs in web UI
- [x] Edit job matching criteria (skills, location, salary)
- [x] Manual trigger for immediate scrape
- [x] Log view/email history in portal

### P2 (COULD)
- [ ] Multiple CV versions
- [ ] Advanced NLP for skill extraction
- [ ] Job application tracking
- [ ] Export matches to CSV/JSON

## Non-requirements
- Multi-user authentication
- Advanced resume writing assistance
- Transactional application system

## Success criteria
- User can upload CV and see matched jobs ✅
- Weekly emails continue sending ✅
- Manual actions work (filter, search) ✅
- No crashes or data loss ✅
- Cero config de base de datos para correr el proyecto ✅
