# Repository Guidelines

## Project Structure & Module Organization
- Flutter app: `lib/` (Dart sources), platform folders `android/`, `ios/`, `windows/`, assets in `assets/` dan `fonts/`.
- Web app (React + Vite + TS): `callpanion-web/` dengan source di `callpanion-web/src/` dan UI di `callpanion-web/src/components/`.
  - Route produksi untuk in-app call (`/dashboard/in-app`) menggunakan `src/pages/InAppDashboard.tsx` dengan komponen:
    1. `InAppCallScheduleManager`
    2. `InAppCallScheduleSettings`
    3. `DevicePairingManager`
    4. `PairedDevicesStatus`
  - Komponen seperti `InAppCallDashboard.tsx` atau `ConversationInsightsDashboard.tsx` bersifat legacy dan tidak digunakan.
- Backend Edge Functions (Supabase Deno/TS): `supabase/functions/<function>/index.ts`.
- Dokumentasi & ops: `README.md`, `SETUP.md`, `MANUAL_DEPLOY_GUIDE.md`, `Knowledge_Callpanion/`.

## Build, Test, and Development Commands
- Flutter
  - Install dependencies: `flutter pub get`
  - Codegen (models/env): `dart run build_runner build --delete-conflicting-outputs`
  - Jalankan aplikasi: `flutter run -d <device>`
  - Build APK: `flutter build apk`
- Web (`callpanion-web/`)
  - Install: `npm ci`
  - Dev server: `npm run dev`
  - Build: `npm run build`
  - Lint: `npm run lint`
- Supabase Edge Functions
  - Local serve per fungsi: `npx supabase functions serve <name>`
  - Deploy (Windows): jalankan `deploy-functions.bat`

## Coding Style & Naming Conventions
- Dart (Flutter): indent 2 spasi; file `snake_case.dart`; kelas `PascalCase`; anggota `camelCase`. Tidak mengedit `*.g.dart` (gunakan build_runner). Gunakan `const` bila memungkinkan.
- TypeScript/React: indent 2 spasi; komponen `PascalCase.tsx`; utilitas `camelCase.ts`. UI dikelompokkan di `src/components/`. Jalankan `npm run lint` sebelum PR.

## Testing Guidelines
- Flutter unit/widget tests: letakkan di `test/` mirroring `lib/`; jalankan `flutter test`.
- Web E2E: `callpanion-web/qa/e2e/` (Playwright) dengan `npm install` lalu `npm run test` / `npm run test:headed` / `npm run test:ci`.
- Fokus coverage pada business logic (`lib/services/`, `callpanion-web/src/lib/`).

## Commit & Pull Request Guidelines
- Gunakan Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`) dengan subject <= 72 karakter.
- PR: sertakan ringkasan, linked issue, screenshot UI (jika relevan), pastikan lint/tests lulus, dan hindari refactor tidak terkait.

## Security & Configuration Tips
- Jangan commit secrets; gunakan Supabase secrets, `.env`, atau `VITE_*`.
- Kredensial push mobile disimpan di luar repo (lihat `MANUAL_DEPLOY_GUIDE.md`). Setelah deploy functions, set secrets sesuai prompt.
