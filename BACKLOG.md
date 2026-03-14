# AIJobRadar — Product Backlog

> Last updated: 2026-03-14

---

## Priority Legend
- **P1**: Next after MVP (high impact, moderate effort)
- **P2**: Important but not urgent
- **P3**: Nice to have / exploratory

---

## Backlog Items

### Monetization
| ID | Item | Priority | Notes |
|----|------|----------|-------|
| B-01 | Define pricing model (freemium? subscription? per-feature?) | P1 | To be discussed with Shuya |
| B-02 | Implement paywall / gated features | P1 | Depends on B-01 |

### Job Board Enhancements
| ID | Item | Priority | Notes |
|----|------|----------|-------|
| B-10 | Startup founder self-upload job posting (via LinkedIn link) | P1 | Let founders submit their own listings |
| B-11 | CEO LinkedIn post scraping as data source | P2 | Scrape hiring announcements from founder LinkedIn posts |
| B-12 | Save / favorite jobs | P1 | Requires user accounts (B-30) |
| B-13 | Job application tracking | P2 | Track which jobs user has applied to |
| B-14 | Email alerts for new matching jobs | P2 | Weekly digest or real-time |
| B-15 | Individual company career page scraping (Path A) | P3 | Per-company scraper for Greenhouse, Lever, Ashby, etc. High maintenance |

### Data Sources
| ID | Item | Priority | Notes |
|----|------|----------|-------|
| B-20 | Growjo API integration (free alternative to Crunchbase) | P1 | Company growth data, funding, revenue estimates |
| B-21 | Apollo.io free tier integration | P2 | Company metadata enrichment |
| B-22 | Crunchbase Enterprise API | P3 | $50K+/year — only if revenue justifies it |
| B-23 | Indeed / Glassdoor job scraping | P2 | Additional job sources |

### User Features
| ID | Item | Priority | Notes |
|----|------|----------|-------|
| B-30 | User accounts / login (Google OAuth) | P1 | Required for save, track, personalize |
| B-31 | Custom role search (beyond 3 preset roles) | P2 | Let users define their own search keywords |
| B-32 | Resume builder / AI resume writer | P3 | Auto-generate resume based on market data + user background |
| B-33 | Mobile app | P3 | |

### Market Analysis Enhancements
| ID | Item | Priority | Notes |
|----|------|----------|-------|
| B-40 | Weekly trend tracking / historical data | P1 | Track skill demand changes over time |
| B-41 | Skill gap analyzer (input your skills, see gap vs market) | P2 | Requires user input or resume upload |
| B-42 | Geographic expansion (global, not just US) | P2 | |
| B-43 | More roles (Data Engineer, ML Engineer, etc.) | P2 | |

### Infrastructure
| ID | Item | Priority | Notes |
|----|------|----------|-------|
| B-50 | Automated company health check (weekly HTTP ping) | MVP | See PRD §4 |
| B-51 | Data quality monitoring / alerting | P1 | Detect when scrapers break |
| B-52 | ~~Daily (instead of weekly) data refresh~~ | ~~P2~~ | Moved to MVP: Job Board daily, Market Analysis weekly |

---

## Completed / Moved to MVP
| ID | Item | Status |
|----|------|--------|
| — | Industry auto-tagging (predefined list) | In MVP |
| — | Salary extraction from JD | In MVP |
| — | Startup badge on job board | In MVP |
| — | Company funding info display | In MVP |
| — | Company active status check | In MVP |
