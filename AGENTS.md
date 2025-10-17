# Repository Guidelines

## Project Structure & Module Organization
- Flutter app: `lib/` (Dart), platforms `android/`, `ios/`, `windows/`, assets in `assets/`, fonts in `fonts/`.
- Web (React + Vite + TS): `callpanion-web/` with sources in `callpanion-web/src/` and UI in `callpanion-web/src/components/`. Production in‑app call route: `/dashboard/in-app` via `callpanion-web/src/pages/InAppDashboard.tsx` using components: `InAppCallScheduleManager`, `InAppCallScheduleSettings`, `DevicePairingManager`, `PairedDevicesStatus`. Legacy files like `InAppCallDashboard.tsx` and `ConversationInsightsDashboard.tsx` are not used.
- Supabase Edge Functions: `supabase/functions/<function>/index.ts`.
- Docs & ops: `README.md`, `SETUP.md`, `MANUAL_DEPLOY_GUIDE.md`, `Knowledge_Callpanion/`.

## Build, Test, and Development Commands
- Flutter: `flutter pub get`; codegen `dart run build_runner build --delete-conflicting-outputs`; run `flutter run -d <device>`; build APK `flutter build apk`.
- Web: `cd callpanion-web`; install `npm ci`; dev `npm run dev`; build `npm run build`; lint `npm run lint`.
- Supabase functions: local serve `npx supabase functions serve <name>`; deploy (Windows) `deploy-functions.bat`.

## Coding Style & Naming Conventions
- Dart: 2‑space indent; files `snake_case.dart`; classes `PascalCase`; members `camelCase`; prefer `const`; do not edit `*.g.dart` (use build_runner).
- TypeScript/React: 2‑space indent; components `PascalCase.tsx`; utilities `camelCase.ts`; group UI under `src/components/`; run `npm run lint` before PR.

## Testing Guidelines
- Flutter: place unit/widget tests in `test/` mirroring `lib/`; run `flutter test`.
- Web E2E (Playwright): `callpanion-web/qa/e2e/`; `npm install` then `npm run test` / `npm run test:headed` / `npm run test:ci`.
- Coverage focus: business logic in `lib/services/` and `callpanion-web/src/lib/`.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (e.g., `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`) with subject ≤ 72 chars.
- PRs: include summary, linked issue(s), UI screenshots when relevant, ensure lint/tests pass, and avoid unrelated refactors.

## Security & Configuration Tips
- Never commit secrets. Use Supabase secrets, `.env`, and `VITE_*` variables.
- Mobile push credentials are stored outside the repo (see `MANUAL_DEPLOY_GUIDE.md`). After deploying functions, set required secrets as prompted.

