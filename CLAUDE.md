# CLAUDE.md — Barbershop Booking Platform

## What this is
A multi-tenant booking app sold to barbershops. Many shops share one codebase and one database. Each shop has its own barbers, services, schedule, and branding. There is always a "tenant" — never just "the shop".

Two surfaces:
- **Public booking page** — client picks a service, barber, and time slot. No login.
- **Dashboard** — owner and barbers log in to manage their agenda.

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS (compiled, not the CDN)
- Supabase (Postgres, Auth, Row Level Security)
- Vercel for hosting

Don't add extra libraries without asking.

## Always do first
- Invoke the `frontend-design` skill before writing any UI.
- Write the database schema first. Show it and get approval before building on top of it.

## Multi-tenancy
- Every table with shop data has a `tenant_id`.
- Isolation is enforced with Supabase Row Level Security, so one shop can never see another's data.
- Each shop is reached at `{slug}.tuapp.com`. A custom domain per shop is optional and added later.
- Never hardcode a tenant, domain, or brand color.

## Booking
- Always store times in UTC; display them in the shop's timezone (default `America/Montevideo`).
- The server computes and validates the final booking time — never trust a time sent by the browser.
- A slot is available if it fits the barber's working hours and doesn't overlap an existing appointment or a blocked time.
- Bookings and blocked time (breaks, days off) live in the same table.
- A client books with name, phone, and email — no account needed.

## Roles
- **Owner** — manages the whole shop: barbers, services, hours, settings.
- **Barber** — manages only their own agenda.
- **Client** — no login; can view or cancel via a link.

## Notifications
- Send an email confirmation automatically when a booking is made.
- For WhatsApp reminders: the dashboard shows tomorrow's bookings with a button that opens WhatsApp with the message pre-filled. Owner taps to send.
- Don't build automated/unofficial WhatsApp sending — it risks getting the shop's number banned.

## Branding
- Each shop has its own logo and colors, stored as data and applied with CSS variables.
- The public booking page must look good in any shop's colors — spend the design effort on typography, spacing, and layout, and let color be the variable.

## Design
Apply the `frontend-design` skill, plus:
- No default Tailwind colors (no indigo/blue-600).
- Different fonts for headings and body.
- Every clickable element has hover, focus, and active states.
- Mobile-first — almost everyone books on a phone.
- All user-facing text in Rioplatense Spanish (voseo: "reservá", "elegí").

## Rules
- Never disable Row Level Security.
- Never expose the Supabase service role key to the browser.
- Never hardcode a tenant, domain, timezone, or brand color.
- Never use `transition-all` or the Tailwind CDN.
- When a scheduling edge case is unclear, ask instead of guessing.
