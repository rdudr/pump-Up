# Pump-Up — Deployment Guide

## Vercel (website + email API)

Pump-Up needs **no database** — field data lives on each device until the
report is submitted, and the report travels by email. So the Vercel set-up
is only the project plus four email settings.

### 1. Create the project

Either push this folder to GitHub and import it at vercel.com/new, or use
the CLI from this folder:

```bash
npx vercel
```

Framework preset: **Next.js** (auto-detected). Build command comes from
`vercel.json` (`npm run build`). Name the project `pump-up` so the default
URL is `https://pump-up.vercel.app` — the Android app posts there. If you
pick another name, set `NEXT_PUBLIC_API_URL` (below) and rebuild the APK.

### 2. Environment variables (Project → Settings → Environment Variables)

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<the Gmail account that sends reports>
SMTP_PASS=<Gmail App Password, 16 characters>
```

Optional:

```
REPORT_RECIPIENTS=a@iitgn.ac.in,b@iitgn.ac.in   # replaces the built-in team list
NEXT_PUBLIC_API_URL=https://<your-domain>        # server used by the Android app
```

For Gmail, `SMTP_PASS` must be an **App Password** (Google Account →
Security → 2-Step Verification → App passwords), not the normal password.

### 3. Deploy

```bash
npx vercel --prod
```

### Email recipients (built in, same as Fox Kisem)

loriyasagar.b@iitgn.ac.in, abhay.maurya@iitgn.ac.in, md.faizan@iitgn.ac.in,
rishabh.dangi@iitgn.ac.in, dhruvit.patel@iitgn.ac.in,
rahuljayantibhai.p@iitgn.ac.in, iea@iitgn.ac.in

Edit `TEAM_EMAILS` in `app/api/sync/queue/route.ts`, or set `REPORT_RECIPIENTS`.

### API routes

- `POST /api/sync/queue` — builds the Excel report and emails it to the team (CORS enabled for the app)

## Android app (Capacitor)

Package `com.kisem.pumpup`, app name **Pump-Up**. The Android app is the
static build of the same screens; it sends reports to the Vercel URL.

The `android/` project is already in the repo. To make a new APK (stop
`npm run dev` first — it locks `app/api` on Windows):

1. Bump `version` in `package.json` and `versionName` / `versionCode` in `android/app/build.gradle`.
2. Build:

```bash
npm run build:mobile
```

```bash
npx cap sync android
```

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"; cd android; .\gradlew.bat assembleDebug; cd ..
```

```bash
npm run export:apk
```

The APK lands in `releases/pump-up-v<version>.apk`. It needs JDK 21 (the
one bundled with Android Studio works) and the Android SDK. After changing
`APP logo.png`, run `npm run icons` before syncing.

## Checklist before going live

1. `npm run test:calc -- "<Pump Analysis.xlsx>"` passes.
2. Vercel env vars set; send one test report and check it arrives with the Excel attached.
3. Open the attached Excel in Excel — the `PUMPS_Transit` / `PUMPS_Doppler` sheets recalculate.
