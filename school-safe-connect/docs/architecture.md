# School Safe Connect (SSC) - Architecture Specification

## 1. Platform Account Types & Client Separation

The platform enforces strict client application boundaries between Web Dashboard and Mobile Application:

```
+----------------------------------------------------------------------------------+
|                            PLATFORM CLIENT TOPOLOGY                              |
+----------------------------------------------------------------------------------+
| A. WEB APPLICATION (Next.js 14 + Tailwind CSS)                                   |
|    For administrative and management staff:                                      |
|    - Global Super Admin (SSC-GSA-001)                                            |
|    - School Admin (SSC-SCH-XXXX-ADM-XXX)                                         |
|    - Transport Coordinator                                                       |
|    * STRICT RULE: Mobile users must not access administrative web dashboards.    |
+----------------------------------------------------------------------------------+
| B. MOBILE APPLICATION (Flutter)                                                  |
|    For daily field operations and custody monitoring:                            |
|    - Parent (SSC-SCH-XXXX-PAR-XXX)                                               |
|    - Teacher (SSC-SCH-XXXX-TCH-XXX) [Class & Subject Teachers]                   |
|    - Driver (SSC-SCH-XXXX-DRV-XXX)                                               |
|    * STRICT RULE: Web users must not use the mobile app for admin functions.     |
+----------------------------------------------------------------------------------+
```

A user may have only one primary role. Role and client platform claims are cryptographically embedded in every JWT access token and enforced by `tenantGuard` and `rbacGuard`.

## 2. High-Level Architecture Overview

```
                              [ Clients ]
        +-------------------------+-------------------------+
        |                                                   |
   Flutter Mobile                                     Next.js 14 Web
  (Parents, Teachers, Drivers)                      (Super Admin, School Admin,
                                                     Transport Coordinator)
        |                                                   |
        +-------------------------+-------------------------+
                                  |
                                HTTPS (X-Client-Type)
                                  |
                   [ Cloudflare / Reverse Proxy ]
                     (WAF, DDoS, Rate Limiting)
                                  |
                [ Node.js + Express Central API ]
               (JWT + 2FA, Tenant Guard, RBAC)
         +------------------------+------------------------+
         |                        |                        |
     MongoDB Atlas              Redis                  MediaMTX
 (Logical Partitioning)     (Cache / Token)        (RTSP -> Live HLS)
```

## 3. Multi-Tenant Isolation Strategy

- **Tenant Identifier**: Every tenant is assigned a permanent, collision-free code `SSC-SCH-XXXX` (e.g. `SSC-SCH-1023`, `SSC-SCH-2045`).
- **Cryptographic Grounding**: The tenant `schoolCode` is derived exclusively from the verified JWT access token.
- **Tenant Guard Middleware**:
  1. Validates that `req.user` contains a verified `schoolCode`.
  2. Binds `req.tenantSchoolCode = req.user.schoolCode`.
  3. Inspects URL route params, query parameters, and request body. If any foreign `schoolCode` is detected, the request is immediately terminated with `403 Forbidden` and flagged to the audit ledger.
  4. Database queries on all tenant-owned collections enforce `{ schoolCode: req.tenantSchoolCode }`.
- **Global Super Admin Isolation**: Super Admin operates outside any single tenant. Any cross-tenant inspection requires:
  - `X-School-Code` header specifying the target.
  - `X-Super-Admin-Reason` header (minimum 10 characters).
  - An immutable audit trail entry logged prior to query execution.

## 4. User Role Hierarchy

```
Global Super Admin (SSC-GSA-001) [WEB ONLY]
  └── School Tenant (SSC-SCH-XXXX)
        ├── School Admin (SSC-SCH-XXXX-ADM-001) [WEB ONLY]
        │     ├── Transport Coordinator (TRC) [WEB ONLY]
        │     ├── Class Teacher (TCH) [Class-level Routing Layer - MOBILE ONLY]
        │     ├── Subject Teacher (TCH) [MOBILE ONLY]
        │     ├── Parent (PAR) [Child-level Scoped - MOBILE ONLY]
        │     └── Driver (DRV) [Trip & Vehicle Scoped - MOBILE ONLY]
        └── Archived Academic Years
```

## 5. Key Security Controls

1. **Mandatory 2FA**: Every user authenticates via password followed by a cryptographically secure 6-digit OTP (5-minute expiry, max 5 attempts, 10-minute cooldown).
2. **Client Platform Isolation**: Enforces that mobile users cannot authenticate or access administrative web dashboards, and administrative users cannot use the mobile app.
3. **Delayed Transport Telemetry**: GPS telemetry is timestamped with `visibleAfter = serverReceivedAt + delaySeconds` (default 30s). Parents can only query data where `visibleAfter <= now()`.
4. **Live-Only CCTV Access**:
   - Zero recording, download, or replay.
   - Dynamic forensic watermarks containing parent name, child name, class, userCode, session ID, and timestamp.
   - Strict class-wise timing controls (e.g., 09:00 - 16:00).
   - Screen capture and recording protections enabled via mobile platform flags.
