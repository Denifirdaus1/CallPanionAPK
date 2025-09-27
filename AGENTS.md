# Repository Guidelines

## Project Structure & Module Organization
- Flutter app: `lib/` (Dart sources), platform folders `android/`, `ios/`, `windows/`, assets in `assets/` and `fonts/`.
- Web app (React + Vite + TS): `callpanion-web/` with source in `callpanion-web/src/` and UI in `callpanion-web/src/components/`.
- Backend Edge Functions (Supabase Deno/TS): `supabase/functions/<function>/index.ts`.
- Docs and ops: `README.md`, `SETUP.md`, `MANUAL_DEPLOY_GUIDE.md`, `Knowledge_Callpanion/`.

## Build, Test, and Development Commands
- Flutter
  - Install deps: `flutter pub get`
  - Codegen (models/env): `dart run build_runner build --delete-conflicting-outputs`
  - Run: `flutter run -d <device>` (e.g., `-d chrome`, emulator ID)
  - Build APK: `flutter build apk`
- Web (`callpanion-web/`)
  - Install: `npm ci`
  - Dev server: `npm run dev`
  - Build: `npm run build`
  - Lint: `npm run lint`
- Supabase Edge Functions
  - Local serve (per fn): `npx supabase functions serve <name>`
  - Deploy (Windows): run root `deploy-functions.bat`

## Coding Style & Naming Conventions
- Dart (Flutter): 2‑space indent; `snake_case.dart` files; classes `PascalCase`; members `camelCase`. Do not edit generated `*.g.dart` files; run build_runner instead. Prefer `const` where possible.
- TypeScript/React: 2‑space indent; components `PascalCase.tsx`; utility/modules `camelCase.ts`. Keep UI components in `src/components/` and colocate styles. Run `npm run lint` before PRs.

## Testing Guidelines
- Flutter unit/widget tests: place in `test/` mirroring `lib/`; run `flutter test`.
- Web E2E: `callpanion-web/qa/e2e/` (Playwright). Commands: `npm install`, then `npm run test`, `npm run test:headed`, or `npm run test:ci`.
- Aim for coverage on business logic (services in `lib/services/` and `callpanion-web/src/lib/`).

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`; keep subject ≤72 chars.
- PRs must include: concise description, linked issues, screenshots for UI changes, and pass lint/tests. Keep changes focused and avoid unrelated refactors.

## Security & Configuration Tips
- Never commit secrets; use Supabase project secrets and `.env`/Vite `VITE_*` vars for the web. Android keystores and Apple certs must stay out of VCS.
- Mobile push credentials live outside code; see `MANUAL_DEPLOY_GUIDE.md`. For functions, set secrets after `deploy-functions.bat` as prompted.
