# Claude Configuration for CallPanion Elderly

## Project Overview
CallPanion Elderly is a Flutter VoIP calling application designed for elderly users with native CallKit integration, Firebase Cloud Messaging, and WebView functionality for seamless call experiences.

## Development Commands

### Setup & Dependencies
```bash
# Install dependencies
flutter pub get

# Generate code (for JSON serialization)
flutter packages pub run build_runner build

# Clean generated files and rebuild
flutter packages pub run build_runner build --delete-conflicting-outputs
```

### Development
```bash
# Run app in development mode
flutter run

# Run with specific device
flutter run -d <device_id>

# Hot reload (during development)
r

# Hot restart (during development)
R

# Clean build artifacts
flutter clean
```

### Testing & Analysis
```bash
# Run all tests
flutter test

# Run tests with coverage
flutter test --coverage

# Analyze code for issues
flutter analyze

# Format code
dart format .
```

### Building

#### Android
```bash
# Build debug APK
flutter build apk --debug

# Build release APK
flutter build apk --release

# Build app bundle for Play Store
flutter build appbundle --release
```

#### iOS
```bash
# Build for iOS (requires macOS)
flutter build ios --release

# Build IPA for distribution
flutter build ipa --release
```

### Debugging
```bash
# Run with debugging enabled
flutter run --debug

# Profile performance
flutter run --profile

# Check device info
flutter devices

# Doctor check
flutter doctor
```

### Platform-Specific Notes

#### Android Configuration
- Minimum SDK: 21 (Android 5.0)
- Target SDK: Latest stable
- Permissions: INTERNET, POST_NOTIFICATIONS, USE_FULL_SCREEN_INTENT
- Features: CallKit integration, Firebase messaging

#### iOS Configuration
- iOS 11.0+ required for CallKit
- Background modes: voip, remote-notification, processing
- VoIP push notifications configured
- CallKit integration for native call UI

### Firebase Integration
- Firebase Core initialized in main.dart
- FCM for push notifications
- VoIP notifications for iOS

### Project Structure
```
lib/
├── main.dart                 # App entry point
├── models/                   # Data models
│   ├── call_data.dart       # Call data structure
│   └── device_info.dart     # Device information
├── services/                 # Business logic services
│   ├── callkit_service.dart # CallKit integration
│   ├── fcm_service.dart     # Firebase messaging
│   ├── api_service.dart     # API communication
│   ├── permission_service.dart # Permissions handling
│   └── network_service.dart # Network connectivity
├── screens/                  # UI screens
│   ├── main_screen.dart     # Main app screen
│   ├── call_screen.dart     # Call interface
│   └── webview_call_screen.dart # WebView integration
└── utils/
    └── constants.dart        # App constants
```

### Common Issues & Solutions

#### Permission Issues
```bash
# Check current permissions
flutter run --verbose
```

#### Build Issues
```bash
# Clean and rebuild
flutter clean
flutter pub get
flutter build apk
```

#### iOS Build Issues
```bash
# Clean iOS build
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
flutter clean
flutter build ios
```

### Development Workflow
1. Make changes to code
2. Test with `flutter analyze`
3. Run tests with `flutter test`
4. Build and test on device with `flutter run`
5. For release: `flutter build apk --release`

### Environment
- Flutter SDK: 3.35.3+
- Dart: 3.9.2+
- Android SDK: 34+
- iOS: 11.0+

### Dependencies
Key packages used:
- flutter_callkit_incoming: Native call experience
- firebase_messaging: Push notifications
- firebase_core: Firebase integration
- webview_flutter: In-app call interface
- shared_preferences: Local storage
- permission_handler: Runtime permissions
- connectivity_plus: Network status
- wakelock_plus: Screen wake management

## Git Workflow & Branch Management

### Repository Structure
```
main branch          (Production-ready code)
├── develop          (Integration branch for features)
├── feature/*        (Feature development branches)
└── hotfix/*         (Emergency fixes for production)
```

### Branch Strategy

#### Main Branch (main)
- **Purpose**: Production-ready, stable code
- **Protection**: Never push directly, only merge via PR
- **Deployment**: Auto-deploy to production

#### Develop Branch (develop)
- **Purpose**: Integration branch for all features
- **Usage**: Merge completed features here for testing
- **Stability**: Should always be in working state

#### Feature Branches (feature/*)
- **Naming**: `feature/feature-name` or `feature/core-development`
- **Purpose**: Develop new features or major changes
- **Workflow**: Branch from develop, merge back to develop

#### Hotfix Branches (hotfix/*)
- **Naming**: `hotfix/emergency-fixes` or `hotfix/critical-bug`
- **Purpose**: Emergency fixes for production issues
- **Workflow**: Branch from main, merge to both main and develop

### Git Commands for Safe Development

#### Daily Development Workflow
```bash
# Switch to develop branch
git checkout develop

# Pull latest changes
git pull origin develop

# Create feature branch
git checkout -b feature/new-feature

# Work on your changes...
# Stage and commit changes
git add .
git commit -m "Add new feature implementation"

# Push feature branch
git push -u origin feature/new-feature

# Create Pull Request on GitHub to merge into develop
```

#### Safe Version Management
```bash
# Create a checkpoint before major changes
git tag -a v1.0.0 -m "Stable version before major changes"
git push origin v1.0.0

# Check commit history
git log --oneline

# Revert to previous commit if needed
git reset --hard <commit-hash>

# Restore specific file from previous commit
git checkout <commit-hash> -- path/to/file
```

#### Emergency Hotfix Workflow
```bash
# Create hotfix from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-fix

# Make fix and test
git add .
git commit -m "Fix critical production issue"

# Push and create PR to main
git push -u origin hotfix/critical-fix

# After merge to main, also merge to develop
git checkout develop
git merge hotfix/critical-fix
git push origin develop
```

#### Backup & Recovery
```bash
# Create local backup branch
git branch backup-$(date +%Y%m%d)

# List all branches (local and remote)
git branch -a

# Restore from backup
git checkout backup-20241217
git checkout -b restore-point

# Force push if needed (DANGER: only on your branches)
git push --force-with-lease origin feature/your-branch
```

### GitHub Repository Setup
- **URL**: https://github.com/Denifirdaus1/CallPanionAPK.git
- **Default Branch**: main
- **Auto-merge**: Disabled for main branch
- **Required Reviews**: Recommended for main branch

### Version Control Best Practices

#### Commit Message Format
```bash
# Feature commits
git commit -m "feat: add ElevenLabs WebRTC integration"

# Bug fixes
git commit -m "fix: resolve CallKit notification issues"

# Documentation
git commit -m "docs: update integration guide"

# Refactoring
git commit -m "refactor: improve API service error handling"
```

#### Recovery Commands
```bash
# If you made mistake and need to go back
git log --oneline                    # Find the good commit
git reset --hard <good-commit-hash>  # Reset to that commit
git push --force-with-lease origin <branch-name>

# Undo last commit but keep changes
git reset --soft HEAD~1

# Discard all uncommitted changes
git stash
# or
git checkout -- .
```

### Branch Protection Rules (Recommended GitHub Settings)

#### For main branch:
- Require pull request reviews before merging
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Include administrators in restrictions

#### For develop branch:
- Require pull request reviews (can be less strict)
- Allow force pushes (for integration fixes)

### Project Backup Strategy
```bash
# Weekly full backup
git clone --mirror https://github.com/Denifirdaus1/CallPanionAPK.git backup-$(date +%Y%m%d)

# Or create release tags for major milestones
git tag -a release-v1.0 -m "Production release v1.0"
git push origin release-v1.0
```