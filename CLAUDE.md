# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**APS Manager** is a React Native / Expo mobile app for hospital Acute Pain Service teams. It allows nurses and doctors to track post-operative patients, record NRS (Numeric Rating Scale) pain scores, manage surgical interventions, and receive alerts for high-pain or missing measurements.

The app targets iOS and Android. The primary language is Italian, with English as a secondary locale.

## Commands

```bash
# Start Expo dev server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Build with EAS (cloud builds)
eas build --profile development
eas build --profile preview
eas build --profile production
```

There are no lint or test scripts configured in `package.json`.

## Architecture

### Navigation

`src/navigation/AppNavigator.tsx` is the single navigation entry point. It:
- Wraps the app in `AuthContext.Provider` (the auth state lives here, not in a Redux store)
- Shows `LoginScreen` if unauthenticated, otherwise renders a bottom-tab navigator (`MainTabs`) plus a stack of modal/detail screens

**Bottom tabs:** Dashboard → Patients → Notifications → Profile
**Stack screens (require auth):** PatientDetail, AddPatient, NRSEntry (modal), AddIntervention (modal), Export, Stats, Opioid

### Auth

`src/hooks/useAuth.ts` exposes `useAuthProvider()` (called once in `AppNavigator`) and `useAuth()` (consumed everywhere else via context). Auth supports:
- Email/password via Supabase
- Biometric login (Face ID / fingerprint) using credentials cached in `expo-secure-store`
- PIN unlock
- 30-minute session timeout with auto sign-out

### Backend / Database

All data access goes through `src/services/supabase.ts` — a single `supabase` client instance. There is no local state management layer (no Redux, no Zustand); screens query Supabase directly.

The database schema is fully typed in `src/types/database.ts`. Key tables:

| Table | Purpose |
|---|---|
| `profiles` | User accounts with roles (`medico`, `infermiere`, `paziente`, `admin`) |
| `patients` | Hospitalised patients with ward/bed/admission info |
| `interventions` | Surgical procedures linked to a patient, including NRS schedule and alert threshold |
| `nrs_measurements` | Pain score entries (NRS 0–10, rest + movement, alert level) |
| `notifications` | In-app notifications with priority levels |

Alert levels (`verde`/`giallo`/`rosso`) are computed from NRS value against each intervention's `nrs_alert_threshold`.

### Internationalisation

`src/i18n/index.ts` initialises i18next with `it` (default) and `en` translation bundles. All UI strings must use `useTranslation()` — never hardcode Italian or English text directly. Notifications store both `title`/`body` (Italian) and `title_en`/`body_en` fields.

### Theming

`src/utils/theme.ts` exports `Colors`, `Typography`, `Spacing`, `Radius`, `Shadow`, and NRS colour helpers (`getNrsColor`, `getNrsBackground`, `getAlertColor`). All screens use these constants — avoid inline colour literals.

### EAS / Distribution

`eas.json` defines three build profiles:
- `development`: development client, internal distribution
- `preview`: internal distribution (TestFlight / internal track)
- `production`: auto-increments build number, targets stores

Bundle identifier: `it.ior.aps-manager` (iOS). EAS project ID: `39d907c6-bf0b-44ca-a628-7a2ef0ef55a9`.
