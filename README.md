
# WorkoWork

WorkoWork is an AI-assisted internship/work journal built with Expo, React Native, Supabase, and Gemini.

The product flow is simple:

```text
Open → Log → AI organizes → Close
```

Users can log daily work, reflect on learning/challenges, receive AI-generated summaries, track growth, add mentor feedback, view dashboard insights, generate weekly reflections, and create/export an internship report.

---

## Tech Stack

- Expo
- React Native
- TypeScript
- React Navigation
- Supabase
- Gemini API
- Expo Print
- Expo Sharing

---

## Prerequisites

Install these before starting:

- Node.js
- npm
- Expo Go app on your phone

---

## Setup Instructions

Clone the project:

```bash
git clone <repo-url>
cd workowork
```

Install dependencies:

```bash
npm install
```

Create a `.env` file in the project root.

Use the shared environment values:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
```

Important: the Supabase URL must look like this:

```env
https://your-project.supabase.co
```

Do not include `/rest/v1`.

---

## Start The App

Run:

```bash
npx expo start
```

If things look cached or outdated, run:

```bash
npx expo start -c
```

Then scan the QR code using Expo Go.

---

## Database Setup

The Supabase database is organized by phase SQL files inside the `supabase/` folder.

Run these files in the Supabase SQL editor if the database is not already set up:

```text
supabase/phase1.sql
supabase/phase2.sql
supabase/phase3.sql
supabase/phase4.sql
supabase/phase-delete-policy.sql
```

If the shared Supabase project is already configured, you do not need to run them again.

---

## Main App Flow

```text
App Launch
  ↓
Check Supabase session
  ↓
No session → Login
  ↓
Signup/Login success
  ↓
Profile incomplete → Onboarding
  ↓
Profile complete → Home
```

Main screens:

- Login
- Signup
- Onboarding
- Home Timeline
- Add Daily Log
- Log Detail
- Dashboard
- Internship Report

---

## Features

### Authentication

Users can create an account and log in using email and password.

### Onboarding

The app collects:

- Internship role
- Company
- Duration
- Goal

This information is stored in the `profiles` table and used by AI generation.

### Daily Logs

Users can add structured daily logs:

- Work done
- Learning
- Challenges
- Solutions
- Productivity score
- Confidence score
- Stress score
- Tomorrow plan

### AI Analysis

After saving a log, raw data is saved immediately.

Then AI runs in the background and generates:

- Professional summary
- Skills used
- Weaknesses
- Suggestions
- Resume bullet

### Mentor Feedback

Users can add mentor feedback inside each log detail screen.

### Dashboard

The dashboard shows:

- Total logs
- Current streak
- Weekly productivity
- Average confidence
- Confidence trend
- Most used skills
- Top weaknesses
- Weekly summaries

### Weekly Reflections

After every 7 logs, the app generates a weekly reflection using Gemini.

### Internship Report

Users can generate a final internship report from:

- Daily logs
- AI analysis
- Mentor feedback
- Weekly reflections
- Profile context

The report can be:

- Previewed in the app
- Exported as PDF
- Shared as text

---

## Useful Commands

Start app:

```bash
npx expo start
```

Start with cache clear:

```bash
npx expo start -c
```

Type check:

```bash
npx tsc --noEmit
```

Lint:

```bash
npm run lint
```

---

## Project Structure

```text
src/
  context/
    AuthContext.tsx

  navigation/
    AppNavigator.tsx
    types.ts

  screens/
    LoginScreen.tsx
    SignupScreen.tsx
    OnboardingScreen.tsx
    HomeScreen.tsx
    AddLogScreen.tsx
    LogDetailScreen.tsx
    DashboardScreen.tsx
    ReportScreen.tsx

  services/
    supabase.ts
    gemini.ts
    aiAnalysis.ts
    weeklyReflections.ts
    reportExport.ts

  styles/
    theme.ts

  types/
    workowork.ts

  utils/
    debug.ts

supabase/
  phase1.sql
  phase2.sql
  phase3.sql
  phase4.sql
  phase-delete-policy.sql
```

---

## Notes For Development

The app currently runs through React Navigation.

The active entry files are:

```text
index.js
App.tsx
src/navigation/AppNavigator.tsx
```

The `app/` folder from Expo Router may still exist, but the active runtime uses React Navigation.

---

## Important UX Rule

Daily log saving should stay instant.

The correct flow is:

```text
Save raw log
↓
Navigate back immediately
↓
Run AI in background
↓
Update timeline when ready
```

Do not make the user wait for AI while saving a daily log.
```