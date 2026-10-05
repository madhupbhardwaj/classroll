# Classroll

A student–teacher attendance portal for Vercel. Teachers create classes, display a QR code that rotates every 30 seconds, review and correct attendance, invite colleagues, and export daily CSV files. Students scan the QR and enter their class code, roll number, and private PIN.

## Publish with GitHub and Vercel

1. Create a new GitHub repository (private or public). Add the **contents of this folder** to the repository. Keep `.env` files out of GitHub; `.gitignore` already excludes them.
2. In [Vercel](https://vercel.com/new), import that GitHub repository. Vercel detects **Next.js**. The root directory should be the repository root. The build command is `next build` and does not need a custom setting.
3. Add a Postgres database. In the Vercel dashboard, open **Storage / Marketplace** and connect **Neon** to this project. Copy its **pooled** Postgres connection string into the project’s `DATABASE_URL` environment variable if the integration has not already created that exact variable. Set it for Production, and for Preview too if you want preview deployments to work. Do not expose the URL with a `NEXT_PUBLIC_` prefix.
4. Set `TEACHER_SETUP_CODE` as a Production environment variable. Generate a long random value, for example `openssl rand -hex 24` in Terminal. Save it privately; the first teacher needs it once. Do not put it in source code or `.env.example`.
5. In the Neon SQL Editor, run the full contents of [`db/schema.sql`](db/schema.sql). It creates the tables and indexes. Alternatively, locally set `DATABASE_URL` in `.env.local`, load that variable into your shell, and run `npm run db:migrate`.
6. Redeploy in Vercel after setting the environment variables. Open `/teacher`, choose **Create an account**, and enter the setup code. The first teacher can invite additional teachers; the app shows a one-time invitation code to share privately. Students use `/check-in` through the QR link and do not need accounts.

Vercel automatically deploys future pushes to the linked GitHub branch. The earlier ChatGPT-hosted site uses a separate database; records from it do not automatically appear in this installation.

## Local development

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env.local`, set the real database URL and setup code, then run `npm run db:migrate` and `npm run dev`. Never commit `.env.local`.

## How attendance works

- A class has a unique code and a roster. Each student receives a six-digit PIN, shown to the teacher only when created or reset. PINs are stored with a salt and PBKDF2 hash.
- A teacher starts one session per class per local calendar day. The QR contains a short-lived signed token for that session and refreshes every 30 seconds. It is accepted for the current or preceding 30-second window while the session is open.
- The class code, roll number, PIN, QR token, and open session must all match. Five failed PIN attempts lock that student’s check-in for 15 minutes. A unique database constraint prevents duplicate attendance records.
- Teachers can record a manual correction with a reason, view previous dates, and export CSV. The attendance database is the source of truth across devices.
- Teachers use password-based accounts and server-side sessions in HttpOnly cookies. Invitations use one-time codes. Student names and attendance never belong in GitHub files.

A student who shares both a live QR link and their PIN can still ask someone else to check in. For higher-stakes attendance, display the QR in the room for a short period and reconcile the roster in person. Provide a manual fallback for students without a working phone or internet.

## Files

- `app/` — pages and API routes
- `db/schema.sql` — Postgres schema, run once for a new database
- `lib/` — database and authentication helpers
- `.env.example` — required variable names, without secrets

## Limits and operations

The first installation starts with an empty roster. Back up the Neon database according to your school’s retention policy. Anyone with the public Vercel URL can see the student check-in form, while teacher actions require a teacher account. Only invite trusted teachers: every teacher currently has access to all classes in this installation.
