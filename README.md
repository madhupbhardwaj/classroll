# Classroll

A student–teacher attendance portal for Vercel. Teachers create classes, display a QR code that rotates every 30 seconds, review and correct attendance, invite colleagues, and export daily CSV files. Students scan the QR and enter their class code, roll number, and private PIN.

## Publish with GitHub and Vercel

1. Create a new GitHub repository (private or public). Add the **contents of this folder** to the repository. Keep `.env` files out of GitHub; `.gitignore` already excludes them.
2. In [Vercel](https://vercel.com/new), import that GitHub repository. Vercel detects **Next.js**. The root directory should be the repository root. The build command is `next build` and does not need a custom setting.
3. Add a Postgres database. In the Vercel dashboard, open **Storage / Marketplace** and connect **Neon** to this project. Copy its **pooled** Postgres connection string into the project’s `DATABASE_URL` environment variable if the integration has not already created that exact variable. Set it for Production, and for Preview too if you want preview deployments to work. Do not expose the URL with a `NEXT_PUBLIC_` prefix.
4. Set `TEACHER_SETUP_CODE` as a Production environment variable. Generate a long random value, for example `openssl rand -hex 24` in Terminal. Save it privately; the first teacher needs it once. Do not put it in source code or `.env.example`.
   Also set `PIN_DISPLAY_KEY` to a separate value from `openssl rand -hex 32`. Keep it private and stable: new and reset student PINs can be revealed in the student portal only while this key remains the same. Existing QR check-in works even if the key is unavailable, but PIN viewing will not.
5. In the Neon SQL Editor, run the full contents of [`db/schema.sql`](db/schema.sql). It creates the tables and indexes. Alternatively, locally set `DATABASE_URL` in `.env.local`, load that variable into your shell, and run `npm run db:migrate`.
6. Configure Google sign-in as described below, then redeploy in Vercel. Open `/teacher`, choose **Create an account**, and enter the setup code. The first teacher can invite additional teachers; the app shows a one-time invitation code to share privately. Students use `/check-in` through the QR link. They can also sign in with Google at `/student` to view their own classes, tasks and attendance.

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

The first installation starts with an empty roster. Back up the Neon database according to your school’s retention policy. Anyone with the public Vercel URL can see the student check-in form, while teacher actions require a teacher account. Each teacher can access only classes they created.

## Student accounts and class tasks

For an existing deployment, run `db/student-tasks-migration.sql` in the Neon SQL Editor **before** uploading the updated application files. For a fresh deployment, use the full `db/schema.sql` instead. The migration preserves existing attendance records.

Teachers now see only classes created by their own account. From `/teacher/tasks` they can create tasks with a name, due date and optional description, edit or delete them, mark each student submitted/not submitted/unmarked, search the roster, see counts and export a task CSV. Deleting a task permanently deletes its submission marks.

Students sign in with a Gmail or Google Workspace account at `/student`. A teacher adds that exact email when creating a student roster entry, or sets an email on an existing student's profile. The student then joins from their portal using the class code, roll number and their existing private PIN. A student can link multiple classes to one account. New students automatically appear unmarked on all tasks in their class. The student portal is read-only for task marks and attendance.

## Google sign-in update for the existing deployment

1. In **Neon → SQL Editor**, run the complete `db/student-google-migration.sql`. It permanently removes **student accounts and student sessions** used for testing and disconnects their roster links. It does **not** remove student roster records, PINs, tasks, attendance, teacher accounts, or classes. Students will sign in again and rejoin their classes with their existing class code, roll and PIN. If a student has forgotten that PIN, the teacher can reset it from the roster.
2. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), configure the Google Auth Platform consent screen for external users and create an **OAuth client ID → Web application**. Add `https://classroll-sigma.vercel.app` under **Authorized JavaScript origins** and `https://classroll-sigma.vercel.app/api/student-auth/google` under **Authorized redirect URIs**. If your app is in testing mode, add each Google account that will test it as a test user; configure it for production before opening it to all students. For local development also add `http://localhost:3000` and `http://localhost:3000/api/student-auth/google` respectively.
3. In **Vercel → Project → Settings → Environment Variables**, add `GOOGLE_CLIENT_ID` (the web client ID ending in `.apps.googleusercontent.com`) and `GOOGLE_CALLBACK_URL` (`https://classroll-sigma.vercel.app/api/student-auth/google`) for Production. These are configuration values, not the Google client secret. Do not upload a client secret to GitHub; this flow does not require it. If you use another domain, use that domain in Google Cloud and `GOOGLE_CALLBACK_URL` instead.
4. Upload the changed files to the GitHub repository, preserving their folders. Vercel will build the new deployment. The SQL migration must run **before** these files are deployed. Then open `/student`, press **Continue with Google**, and sign in with the same email the teacher added to the roster. Enter class code, roll number and PIN in **Join a class**.

Google's identity token is validated on the server against its public signing keys, audience, issuer and expiration. A Gmail or Google Workspace address is required because Google is authoritative for those addresses. Google account IDs are stored separately from email addresses. Student passwords are no longer accepted. Teacher email/password accounts and the QR check-in form are unchanged.

## Student PIN viewing update

Set `PIN_DISPLAY_KEY` in Vercel Production environment variables to a private 64-character hexadecimal value (`openssl rand -hex 32`), then redeploy. No SQL migration is needed for this update. New students and teacher-reset PINs created after the key is set can be seen by their linked student account at `/student` while holding the eye button. The PIN hides when the button is released, the tab loses focus or the student switches classes. It is never included in the ordinary dashboard response.

Older PINs cannot be recovered from their stored hashes. Once a student has joined a class, they can choose **Create a viewable PIN** in the portal. This replaces their previous PIN immediately; they must use the new one for future QR check-ins. Teachers can also reset a student's PIN, which makes the new PIN viewable to the linked account. Keep `PIN_DISPLAY_KEY` unchanged after setup. If it is lost or changed, students can create new viewable PINs once the new key is configured; their current PIN remains valid for check-in until replaced.

## Archive update for an existing database

Before deploying the updated code, run `db/archive-migration.sql` in the Neon SQL Editor. Archive hides a class or student without deleting attendance records. Teachers can restore them from the dashboard. Archiving an active class closes its attendance session; restoring it does not reopen that session.
