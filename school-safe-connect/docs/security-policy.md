# School Safe Connect (SSC) - Security Policy & Data Isolation Standards

## 1. Zero Trust Principles
1. **Never Trust Client Identifiers**: `schoolCode`, `role`, `userCode`, `studentCode`, `classCode`, `busId`, and `cameraId` submitted from the client are never accepted blindly. They are validated against the authenticated JWT session and database state.
2. **Strict Multi-Tenant Separation**: All MongoDB queries for tenant resources must include `schoolCode: req.tenantSchoolCode`.
3. **Immutable Audit Trails**: The `AuditLog` collection uses strict schema pre-hooks to forbid any update, deletion, or replacement.

## 2. Authentication & Session Lifetimes
- **Access Tokens**: Short-lived JWTs valid for 15 minutes.
- **Refresh Tokens**: Rotating tokens valid for 7 days.
- **CCTV Stream Tokens**: Valid for 10 minutes maximum; tied to a single active session ID.
- **2FA OTP**: 6-digit numeric OTP with 5-minute expiry, rate-limited to 5 attempts before a 10-minute cooldown lockout.
- **Password Hashes**: Hashed with bcrypt (cost factor 12).

## 3. CCTV Child-Privacy Protection
- CCTV streams are strictly **live-only**.
- No persistent recording, clip export, or offline caching.
- Washrooms, changing rooms, and medical facilities are permanently barred (`privacyZone: true`).
- Dynamic forensic watermarks update position every 5-10 seconds to deter recording.
- Mobile clients activate `FLAG_SECURE` on Android and iOS recording detection APIs.

## 4. Emergency & Panic Alerts
- SOS triggers bypass daily parent query limits.
- Alerts are broadcast concurrently via In-App, Push (FCM), WhatsApp, and SMS.
- Incidents are automatically spawned in the incident ledger with critical priority.
