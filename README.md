# Schoolsafeconnect
# School Safe Connect (SSC)

**A multi-tenant, cloud-based school safety and communication platform** that connects school administrators, teachers, parents and bus drivers in one system, with real-time SOS alerts, live bus tracking, privacy-first CCTV access, fee and exam management.

> Status: **in active development** (personal project). Built with AI-assisted coding (Claude, ChatGPT, Cursor), with every generated module reviewed, debugged and tested by hand.

![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?logo=mongodb&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white)
![Flutter](https://img.shields.io/badge/Flutter-Mobile-02569B?logo=flutter&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)

---

## Table of Contents
- [Why SSC](#why-ssc)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [User Roles](#user-roles)
- [Security](#security)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Author](#author)
- [License](#license)

---

## Why SSC
Schools juggle separate tools for attendance, transport, fees, parent messages and emergency response. SSC puts them on **one platform where each school is an isolated tenant**, so a single deployment can safely serve many schools while keeping every school's data private.

## Features

| Area | What it does |
|---|---|
| **SOS / Panic alerts** | Mobile panic button; alerts are pushed in real time to the school's dashboard over WebSockets. |
| **Incident reporting** | Report, track and update incident status with live updates for staff. |
| **Live bus tracking** | Drivers share location; parents follow the bus on a map with a configurable visibility delay for safety. |
| **Live CCTV access** | Live-only streams (no recording) behind time-limited tokens, class-teacher approval, session limits and a moving per-parent watermark. |
| **AI OMR evaluation** | Grades OMR answer sheets against answer keys, updates report cards, exports class results to Excel and notifies parents. |
| **Fees and events** | Fee records, school events and academic-year management. |
| **Timetables, classes and students** | Class and student management, parent-student linking, timetable handling. |
| **Assignments and notices** | Teachers publish assignments and notices; parents receive notifications. |
| **Notifications** | In-app (Socket.IO), push (Firebase), SMS, email and WhatsApp channels with a retrying queue. |
| **Onboarding and approvals** | Schools request onboarding; the Super Admin approves and creates tenants. |
| **Audit logging** | Sensitive actions are recorded for accountability. |

## Architecture

```
        Flutter Mobile App                     Next.js Web Dashboard
   (Parent, Teacher, Driver)            (Super Admin, School Admin, Transport)
              \                                   /
               \         REST + Socket.IO        /
                +-------------------------------+
                |     Node.js / Express API     |
                |  auth -> tenantGuard -> RBAC  |
                +-------+---------------+-------+
                        |               |
                  MongoDB 7          Redis 7
               (multi-tenant data)  (cache / queues)
                        |
                    MediaMTX  (live CCTV streaming: RTSP / HLS / WebRTC)
```

- **Client separation:** admin roles use the web dashboard; parents, teachers and drivers use the mobile app. Client type is enforced from the signed JWT.
- **Tenant isolation:** the school code is taken only from the verified token, never from user input.

See [`docs/architecture.md`](school-safe-connect/docs/architecture.md) for the full specification.

## Tech Stack

- **Backend:** Node.js, Express, Mongoose (MongoDB), Redis, Socket.IO, Joi, Winston, node-cron
- **Web dashboard:** Next.js 14, React, Tailwind CSS, Framer Motion
- **Mobile app:** Flutter (Dart), flutter_map, geolocator, socket_io_client
- **Infrastructure:** Docker Compose, MediaMTX, GitHub Actions CI
- **Integrations:** Firebase (push), AWS S3-compatible storage, SMS, email and WhatsApp providers

## User Roles

| Role | Client | Purpose |
|---|---|---|
| Global Super Admin | Web | Manage all schools (tenants) on the platform |
| School Admin | Web | Run one school: users, classes, fees, CCTV settings |
| Transport Coordinator | Web | Manage routes, buses and trips |
| Class / Subject Teacher | Mobile | Classes, assignments, notices, CCTV approvals |
| Parent | Mobile | Child tracking, notices, fees, live CCTV (when approved) |
| Driver | Mobile | Trip and location sharing |

## Security
- JWT access and refresh tokens, plus OTP-based two-factor login
- Role-based access control (`rbacGuard`) with web/mobile client separation
- Tenant isolation middleware (`tenantGuard`) so schools never see each other's data
- Helmet, CORS, rate limiting and `express-mongo-sanitize`; Joi request validation
- Audit logging of sensitive actions
- CCTV privacy: live-only, no recording, short-lived tokens, forensic watermarking, no cameras in private zones

Details: [`docs/security-policy.md`](school-safe-connect/docs/security-policy.md) and [`docs/cctv-policy.md`](school-safe-connect/docs/cctv-policy.md).

## Getting Started

### Prerequisites
- Node.js 20+
- Docker and Docker Compose
- Flutter SDK (only for the mobile app)

### 1. Clone
```bash
git clone https://github.com/Sailochar/Schoolsafeconnect.git
cd Schoolsafeconnect/school-safe-connect
```

### 2. Start the databases and streaming server
```bash
docker compose up -d mongodb redis mediamtx
```

### 3. Run the backend (port 5000)
```bash
cd backend
npm install
cp .env.example .env      # if no example file exists, create .env from the table below
npm run seed              # optional: load sample data
npm run dev
```

### 4. Run the web dashboard (port 3000)
```bash
cd ../web-dashboard
npm install
npm run dev
```

### 5. Run the mobile app
```bash
cd ../mobile-app
flutter pub get
flutter run
```

### Or run everything with Docker
```bash
docker compose up --build
```

## Environment Variables

Create `backend/.env`. **Never commit this file** (it is in `.gitignore`).

| Variable | Purpose |
|---|---|
| `PORT`, `NODE_ENV`, `CORS_ORIGIN` | Server basics |
| `MONGODB_URI`, `REDIS_URL` | Database and cache connections |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_2FA_TEMP_SECRET` | Token signing secrets (use long random values) |
| `CCTV_STREAM_TOKEN_SECRET`, `MEDIAMTX_API_URL`, `MEDIAMTX_HLS_BASE_URL` | Live CCTV streaming |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_NAME`, `SUPER_ADMIN_PHONE` | First Super Admin account |
| `LLM_PROVIDER`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` | AI features (key must come from the environment) |
| `FIREBASE_*`, `S3_*`, `SMS_*`, `EMAIL_*`, `WHATSAPP_*` | Optional notification and storage providers |

## Testing
```bash
cd school-safe-connect/backend
npm test
```
Jest test suites cover authentication, role-based access, tenant isolation, audit logging, ID generation and school approval. GitHub Actions runs them on every push and pull request against MongoDB and Redis services.

## Project Structure
```
school-safe-connect/
├── backend/          # Express API: routes, controllers, services, models, middlewares, tests
├── web-dashboard/    # Next.js admin dashboard (super admin, school admin, transport)
├── mobile-app/       # Flutter app (parent, teacher, driver)
├── docs/             # Architecture, API, database schema, security and CCTV policy
├── docker-compose.yml
└── docker-compose.prod.yml
```

## Documentation
- [Architecture](school-safe-connect/docs/architecture.md)
- [API reference](school-safe-connect/docs/api-documentation.md)
- [Database schema](school-safe-connect/docs/database-schema.md)
- [Security policy](school-safe-connect/docs/security-policy.md)
- [CCTV privacy policy](school-safe-connect/docs/cctv-policy.md)

## Roadmap
- [ ] Complete parent, teacher and driver mobile screens
- [ ] Expand test coverage beyond the core security modules
- [ ] Add screenshots and a live demo
- [ ] Production deployment guide

## Author
**Lochar Thirumala Sai**, B.Tech Computer Engineering (AI), Marwadi University (2027)
[LinkedIn](https://linkedin.com/in/lochar-thirumala-sai) | [GitHub](https://github.com/Sailochar) | sailochar135@gmail.com

## License
See the [LICENSE](LICENSE) file.
