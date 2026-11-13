# Developmental and Operating Cost Estimate

This document estimates the **developmental cost** (one-time build cost) and the
**operating cost** (recurring cost) of LacoQR, the dynamic QR attendance system
described in `README.md`, `docs/PROJECT_ANALYSIS.md`, and `docs/DATA_MODEL.md`.

All amounts are in **Philippine pesos (₱)**. No foreign-currency column is used.
Hosting providers bill in their own currency; the peso figures below are budget
estimates and should be re-checked before the defense or before a real
deployment.

Two views are provided for each cost category:

1. **Thesis / out-of-pocket** — what the student team actually spends, using
   existing hardware and free service tiers.
2. **Commercial replacement value** — what the same scope would cost an
   institution or client if it hired a team and bought the equipment.

---

## 1. Cost assumptions

| Assumption | Value used | Notes |
| --- | --- | --- |
| Project team | 4 people | Project lead/full-stack, backend developer, frontend/mobile developer, QA/documentation |
| Timeline | 4 months (16 weeks) | Thesis build and testing period |
| Effort | 20 hours/person/week | Part-time student schedule |
| Total effort | 1,280 person-hours | 4 people × 320 hours |
| Currency | Philippine peso (₱) | All tables |
| Estimate date | November 2026 | Prices are budget estimates |
| Contingency | 10% of subtotal | Covers price changes, rework, and unexpected fees |
| Hardware in thesis view | Already owned | Laptops and phones are treated as ₱0 out-of-pocket |
| Hardware in commercial view | Purchased for the project | Two developer laptops, one test phone, one display tablet |
| Labor in thesis view | ₱0 cash | Academic requirement; market value is shown separately |
| Labor in commercial view | Monthly market rate | Junior-to-mid Philippine software team rates |
| Deployment in thesis view | Free tiers | Supabase Free, GitHub Free, Expo Free, free static hosting |
| Deployment in commercial view | Paid tiers | Supabase Pro, paid API hosting, EAS Starter, monitoring |

**What is included:** design, development, testing, documentation, deployment
setup, domain, internet share, printing, and a 10% contingency.

**What is excluded:** thesis adviser fees, school tuition, personal meals and
transportation, large-scale load testing, paid advertising, and hardware repair.

---

## 2. Developmental cost (one-time)

### 2.1 Thesis / out-of-pocket scenario

This is the amount the team actually pays. Laptops, phones, and the projector or
TV used for the display terminal are assumed to be existing property.

| Item | Quantity | Unit cost (₱) | Amount (₱) |
| --- | ---: | ---: | ---: |
| Domain name (`.com`, 1 year) | 1 | 700.00 | 700.00 |
| Internet share (4 months) | 4 | 1,500.00 | 6,000.00 |
| Printing, binding, and defense copies | 1 | 5,000.00 | 5,000.00 |
| Test consumables (QR printouts, labels, lanyards) | 1 | 1,500.00 | 1,500.00 |
| Cloud hosting during development | 4 | 0.00 | 0.00 |
| Hardware (existing laptops and phones) | 1 | 0.00 | 0.00 |
| **Subtotal** | | | **13,200.00** |
| Contingency (10%) | | | 1,320.00 |
| **Total developmental cost** | | | **₱14,520.00** |

> **Note on labor:** the team's 1,280 hours are not paid in this scenario. If the
> same hours were billed at the commercial rates in section 2.2, the labor value
> alone would be **₱444,000.00**.

### 2.2 Commercial replacement-value scenario

This is what an institution would budget to have the same system built by a
four-person team over four months.

#### Personnel

| Role | Months | Monthly rate (₱) | Amount (₱) |
| --- | ---: | ---: | ---: |
| Project lead / full-stack developer | 4 | 35,000.00 | 140,000.00 |
| Backend developer | 4 | 28,000.00 | 112,000.00 |
| Frontend/mobile developer | 4 | 28,000.00 | 112,000.00 |
| QA / technical writer | 4 | 20,000.00 | 80,000.00 |
| **Personnel subtotal** | | | **444,000.00** |

#### Hardware

| Item | Quantity | Unit cost (₱) | Amount (₱) |
| --- | ---: | ---: | ---: |
| Developer laptop | 2 | 42,000.00 | 84,000.00 |
| Test Android phone | 1 | 12,000.00 | 12,000.00 |
| Display terminal tablet | 1 | 12,000.00 | 12,000.00 |
| **Hardware subtotal** | | | **108,000.00** |

#### Software, tools, and cloud during development (4 months)

| Item | Quantity | Unit cost (₱) | Amount (₱) |
| --- | ---: | ---: | ---: |
| GitHub Team (4 users) | 16 user-months | 250.00 | 4,000.00 |
| Figma Professional | 4 months | 900.00 | 3,600.00 |
| Domain name (1 year) | 1 | 700.00 | 700.00 |
| Supabase Pro | 4 months | 1,450.00 | 5,800.00 |
| API hosting (Starter) | 4 months | 410.00 | 1,640.00 |
| Expo / EAS | 4 months | 0.00 | 0.00 |
| **Tools and cloud subtotal** | | | **15,740.00** |

#### Other project costs

| Item | Quantity | Unit cost (₱) | Amount (₱) |
| --- | ---: | ---: | ---: |
| Internet and utilities (4 months) | 4 | 2,000.00 | 8,000.00 |
| Documentation, printing, and user training | 1 | 12,000.00 | 12,000.00 |
| **Other subtotal** | | | **20,000.00** |

#### Commercial total

| Cost group | Amount (₱) | Share |
| --- | ---: | ---: |
| Personnel | 444,000.00 | 68.7% |
| Hardware | 108,000.00 | 16.7% |
| Software, tools, and cloud | 15,740.00 | 2.4% |
| Other project costs | 20,000.00 | 3.1% |
| **Subtotal** | **587,740.00** | **90.9%** |
| Contingency (10%) | 58,774.00 | 9.1% |
| **Total developmental cost** | **₱646,514.00** | **100%** |

### 2.3 Comparison

| Scenario | Developmental cost (₱) | Difference from thesis view |
| --- | ---: | ---: |
| Thesis / out-of-pocket | 14,520.00 | — |
| Commercial replacement value | 646,514.00 | 631,994.00 |

The large gap is labor and hardware, not software. The system itself is built
almost entirely on free and open-source tools; the commercial figure reflects
the market value of the hours and equipment.

---

## 3. Operating cost (recurring)

Operating cost covers hosting, domain, maintenance, monitoring, and day-to-day
running of the system after launch. It excludes the one-time developmental cost.

### 3.1 Thesis / free-tier scenario

| Item | Monthly (₱) | Annual (₱) | Basis |
| --- | ---: | ---: | --- |
| Domain name (amortized) | 58.33 | 699.96 | ₱700 ÷ 12 months, annualized |
| Internet share | 1,500.00 | 18,000.00 | Shared campus/home connection |
| Maintenance (student) | 600.00 | 7,200.00 | 4 hours/month × ₱150/hour |
| Consumables and printing | 100.00 | 1,200.00 | Backup QR sheets and labels |
| Cloud services | 0.00 | 0.00 | Supabase Free, GitHub Free, Expo Free, free static hosting |
| **Subtotal** | **2,258.33** | **27,099.96** | |
| Contingency (10%) | 225.83 | 2,709.96 | |
| **Total** | **₱2,484.16** | **₱29,809.92** | |

This is the realistic operating budget for a thesis pilot or a small campus
deployment. Free tiers have limits on database size, monthly active users,
backups, and project pausing; document those limits as a deployment risk.

### 3.2 Production scenario

This assumes a live campus deployment with paid hosting, monitoring, backups, and
part-time professional maintenance.

| Item | Monthly (₱) | Annual (₱) | Share of monthly | Basis |
| --- | ---: | ---: | ---: | --- |
| Supabase Pro | 1,450.00 | 17,400.00 | 14.3% | Managed Postgres, Auth, Storage, Realtime, daily backups |
| API hosting (Starter) | 410.00 | 4,920.00 | 4.0% | Express API always-on instance |
| Domain name (amortized) | 58.33 | 699.96 | 0.6% | ₱700 ÷ 12 months, annualized |
| Expo EAS Starter | 1,120.00 | 13,440.00 | 11.0% | Mobile build and update service |
| Monitoring and backups | 600.00 | 7,200.00 | 5.9% | Uptime monitoring, error tracking, extra backup copy |
| Maintenance (professional) | 4,000.00 | 48,000.00 | 39.4% | 8 hours/month × ₱500/hour |
| Internet and office share | 1,500.00 | 18,000.00 | 14.8% | Campus connection share |
| Consumables | 100.00 | 1,200.00 | 1.0% | Printed fallback materials |
| **Subtotal** | **9,238.33** | **110,859.96** | **90.9%** | |
| Contingency (10%) | 923.83 | 11,085.96 | 9.1% | |
| **Total** | **₱10,162.16** | **₱121,945.92** | **100%** | |

Maintenance labor is the largest recurring item. If the institution's IT office
absorbs maintenance, the cash operating cost drops to about **₱6,162.16 per
month**.

### 3.3 Optional publishing costs

These apply only if the mobile app is distributed through public app stores.

| Item | Type | Amount (₱) |
| --- | --- | ---: |
| Google Play Console registration | One-time | 1,500.00 |
| Apple Developer Program | Annual | 5,700.00 |
| Printed QR stand and backup code kit | One-time | 1,500.00 |
| **Three-year total (all optional items)** | | **₱20,100.00** |

For a campus-only pilot, the app can be distributed as an installable build or
through a private channel, so these fees are optional.

### 3.4 Three-year cost of ownership

| Scenario | Developmental (₱) | 3-year operating (₱) | 3-year TCO (₱) |
| --- | ---: | ---: | ---: |
| Thesis / free-tier | 14,520.00 | 89,429.76 | **103,949.76** |
| Production, no app-store publishing | 646,514.00 | 365,837.76 | **1,012,351.76** |
| Production, with app-store publishing | 646,514.00 | 385,937.76 | **1,032,451.76** |

Formulas:

- `3-year operating = monthly total × 36`
- `3-year TCO = developmental cost + 3-year operating` (the operating figure
  already includes optional publishing where that row applies)
- `annual = monthly total × 12`

---

## 4. Unit-cost sensitivity

Unit cost depends on how many scans the system actually processes. The table
below uses **20,000 scans per year** as the base case: 1,000 students × 20 events.

| Scans per year | Equivalent events at 1,000 students | Production (₱/scan) | Thesis (₱/scan) |
| ---: | ---: | ---: | ---: |
| 5,000 | 5 | 24.39 | 5.96 |
| 10,000 | 10 | 12.19 | 2.98 |
| 20,000 | 20 | 6.10 | 1.49 |
| 40,000 | 40 | 3.05 | 0.75 |
| 80,000 | 80 | 1.52 | 0.37 |

Other unit measures at the base case:

| Measure | Production (₱) | Thesis (₱) |
| --- | ---: | ---: |
| Cost per scan | 6.10 | 1.49 |
| Cost per event (1,000 students) | 6,097.30 | 1,490.50 |
| Cost per student per year | 121.95 | 29.81 |

The system becomes cheaper per scan as event volume grows, because hosting and
maintenance are mostly fixed. Below roughly 5,000 scans per year, the paid
production stack is hard to justify; use the free-tier scenario instead.

---

## 5. Cost drivers and reduction options

| Cost driver | Why it matters | Reduction option |
| --- | --- | --- |
| Maintenance labor | 39.4% of production monthly cost | Train campus IT staff; reduce to 4 hours/month after stabilization |
| Internet and office share | 14.8% of production monthly cost | Use the existing campus connection; remove from project budget if absorbed |
| Supabase Pro | 14.3% of production monthly cost | Stay on Free tier for the pilot; upgrade only when storage or backups require it |
| Expo EAS | 11.0% of production monthly cost | Use the free tier for internal builds; pay only for store releases |
| Monitoring and backups | 5.9% of production monthly cost | Use free monitoring tiers; keep one off-site database dump per week |
| API hosting | 4.0% of production monthly cost | Run the API on the same provider's free tier during the pilot |
| Hardware | 16.7% of commercial developmental cost | Use existing laptops and phones; buy only the test device |
| Contingency | 10% of every scenario | Keep it; do not remove it from the budget |

Other options:

- Use GitHub Education or student developer packs for free or discounted tools.
- Ask the institution for Supabase or cloud credits.
- Keep the domain but use free static hosting for the web dashboard.
- Delay paid app-store publishing until after the thesis defense.
- Archive old `scan_attempts` and `audit_logs` rows to keep the database small.

---

## 6. Summary for the manuscript

| Cost item | Thesis / out-of-pocket | Commercial replacement |
| --- | ---: | ---: |
| Developmental cost (one-time) | ₱14,520.00 | ₱646,514.00 |
| Operating cost per month | ₱2,484.16 | ₱10,162.16 |
| Operating cost per year | ₱29,809.92 | ₱121,945.92 |
| Three-year operating cost | ₱89,429.76 | ₱365,837.76 |
| Three-year TCO | ₱103,949.76 | ₱1,012,351.76 |
| Three-year TCO with app publishing | — | ₱1,032,451.76 |

Recommended wording for the manuscript:

> The system was developed at an actual out-of-pocket cost of ₱14,520.00,
> excluding labor and using existing hardware and free cloud tiers. If the same
> scope were procured commercially, the developmental cost would be approximately
> ₱646,514.00. Operating the system costs about ₱2,484.16 per month in the
> free-tier setup, or ₱10,162.16 per month in a production setup with paid
> hosting, monitoring, and part-time maintenance. The three-year total cost of
> ownership is approximately ₱103,949.76 for the thesis setup and ₱1,012,351.76
> for the production setup, excluding optional app-store publishing.

---

## 7. Notes, formulas, and caveats

### 7.1 Formulas used

| Value | Formula |
| --- | --- |
| Line amount | `quantity × unit cost` |
| Labor amount | `months × monthly rate` |
| Maintenance amount | `hours per month × hourly rate` |
| Domain amortization | `annual domain fee ÷ 12` |
| Contingency | `subtotal × 0.10` |
| Monthly total | `subtotal + contingency` |
| Annual total | `monthly total × 12` |
| Three-year operating | `monthly total × 36` |
| Three-year TCO | `developmental + three-year operating + optional publishing` |
| Cost per scan | `annual operating ÷ scans per year` |

### 7.2 Caveats

1. **Prices change.** Hosting, domain, and app-store fees are set by providers.
   Re-check them before the defense and before signing up.
2. **Free tiers have limits.** Supabase Free can pause inactive projects and has
   storage, bandwidth, and backup limits. A live campus deployment should budget
   for the paid tier.
3. **Labor is the biggest variable.** The commercial total is driven by the
   ₱444,000 personnel estimate. Changing team size, duration, or rates changes
   the total more than any software line.
4. **Hardware is a one-time purchase.** In the commercial view the equipment is
   bought once and is not repeated in the operating cost. Its depreciation is not
   modeled.
5. **The thesis view is not the full economic cost.** It shows cash outlay only.
   The commercial view is the better number for an institutional budget
   proposal.
6. **No inflation or discount rate is applied.** The three-year TCO is a simple
   sum, not a discounted cash-flow analysis.
7. **Taxes, permits, and school overhead are excluded.** Add them if the
   institution requires a formal procurement estimate.
8. **Rounding.** Monthly figures are shown to the centavo and annual figures are
   `monthly × 12`. The domain costs ₱700.00 per year and is shown as ₱58.33 per
   month, so its annualized line is ₱699.96.
