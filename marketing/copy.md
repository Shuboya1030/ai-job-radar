# AIJobRadar Marketing Materials

## Screenshot Guide

| File | What it shows | Best for |
|------|-------------|----------|
| `annotated_01_homepage.png` | Landing page with role cards + industry heat | Overall product intro |
| `annotated_02_jobboard.png` | Job Board with funding badges, filters, HOT tags | Job Board feature demo |
| `annotated_03_market.png` | Market Analysis — skill rankings chart | Resume optimization feature |
| `annotated_04_jobdetail.png` | Job detail with Apply button + company funding sidebar | Apply flow + company transparency |
| `01_homepage.png` | Clean homepage (no annotations) | Clean background for posts |
| `02_jobboard.png` | Clean Job Board | Clean background |
| `03_jobboard_filter.png` | Job Board filtered by Series A | Filter demo |
| `04_market_skills.png` | Market Analysis full page | Full feature view |
| `05_job_detail.png` | Job detail page | Job detail view |
| `06_compare.png` | Role comparison page | Comparison feature |

---

## LinkedIn Post 1: Startup Discovery + Builder Story

Big Tech is tightening. But AI startups raised $189B in February 2026 alone.

The problem? Most of these companies don't post jobs on LinkedIn. Their openings are buried across Greenhouse career pages, Lever boards, and YC's startup directory. And even when you find one — how do you know if it's legit? Is it funded? By whom? How much?

I got frustrated enough to build a solution.

aistartupjob.com — I built this over a weekend using Next.js, Python scrapers, GPT-4o-mini, and Playwright. It pulls AI job postings from 4+ sources daily, then enriches every listing with the company's funding data automatically.

What makes it different from LinkedIn or Indeed:

→ Every job card shows funding stage + amount raised upfront. Seed? Series B? $500M raised? You see it before you even click.
→ A "HOT" badge flags companies that just raised fresh capital — these are the ones scaling their teams right now.
→ Industry heat map shows which AI sectors are hiring most — Robotics, AI/ML infrastructure, and Healthcare AI are leading right now.
→ Filter by funding stage. Want early-stage energy? Filter for Seed/Series A. Want stability? Filter for Series C+.

Some things I learned building it:
- Many "AI companies" on LinkedIn are actually staffing agencies posting on behalf of real companies. I had to build a quality filter to strip them out.
- Funding data is nowhere in one place. I stitch it together from Growjo, TechCrunch RSS feeds, and text extraction from job descriptions themselves.
- Cloudflare blocks most scrapers. Playwright with stealth mode got around it.

350+ active positions. 200+ companies with verified funding data. Updated daily. Free. No login.

https://aistartupjob.com

**Recommended images**: annotated_02_jobboard.png, annotated_01_homepage.png

---

## LinkedIn Post 2: Data-Driven Resume Optimization

I analyzed 350+ AI job postings from the past week. Here's what employers actually want — by the numbers.

AI Engineer:
→ #1 skill: Machine Learning (66% of JDs)
→ #1 tool: Python (82%), followed by PyTorch (38%) — TensorFlow is falling behind at 27%
→ Avg salary: $140K–$200K depending on level

Software Engineer:
→ #1 skill: Algorithms (33%) + Data Structures (32%) — fundamentals still dominate
→ #1 tool: Python (63%), then Java (50%), then JavaScript (35%)
→ Avg salary: $120K–$190K

AI Product Manager:
→ #1 skill: Product Strategy + Stakeholder Management
→ Tools matter less — but SQL and data analysis keep showing up

Why does this matter for your resume?

Most ATS systems filter by keyword match. If 66% of AI Engineer JDs mention "Machine Learning" and your resume doesn't — you're getting filtered out before a human ever sees it.

I built a tool that does this analysis automatically every week: aistartupjob.com/market/ai-engineer

For each role, it shows:
→ Skills ranked by % of job descriptions that mention them
→ "Must-Have" keywords (>30% of JDs) vs "Nice-to-Have" (15-30%)
→ Salary ranges by seniority level (Junior → Staff)
→ Top-paying companies

The data refreshes weekly so you're always seeing current market demand — not last year's trends.

Before you send your next application, spend 2 minutes checking what the market actually wants. It's free:

https://aistartupjob.com

**Recommended images**: annotated_03_market.png, annotated_04_jobdetail.png

---

## 小红书帖子：Startup 求职

**标题**：找 AI Startup 工作的宝藏网站，LinkedIn 上搜不到的职位全在这

最近发现一个专门做 AI 行业求职的网站，分享给大家。

做 AI 方向求职的人应该都有这个感受：LinkedIn 上大部分是大厂的岗位，真正有前景的 AI Startup 很少出现在上面。它们用 Greenhouse、Lever 这些自己的招聘系统，散落在各个角落。

这个网站叫 aistartupjob.com，把这些来源全聚合了。

它有两个核心功能：

第一个是 Job Board。350+ 个 AI 相关职位，来自 LinkedIn、YC 孵化器、还有各种公司自己的招聘页面。最关键的是每个职位卡片上直接显示公司的融资情况——Series A、B、C 融了多少钱一目了然。还可以按融资轮次筛选，比如只看 Series A 阶段的 startup。

第二个是 Market Analysis。每周分析 300+ 个 JD，告诉你现在市场上最需要什么技能。比如 AI Engineer 岗位，82% 的 JD 提到 Python，66% 提到 Machine Learning，PyTorch 38% 已经超过了 TensorFlow 27%。改简历之前看一下，知道该写什么关键词。

免费的，不用注册，每天更新。

链接：aistartupjob.com

#AI求职 #找工作 #简历 #AIEngineer #Startup #美国求职 #转码 #留学生 #求职技巧 #薪资

**推荐配图**: annotated_02_jobboard.png, annotated_03_market.png
