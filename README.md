# CampusConnect: University Club, Event & Activity Management Platform

CampusConnect is a centralized, multi-tenant web application designed for university extracurricular management. It replaces fragmented communication channels and error-prone spreadsheets with an integrated, auditable, and automated web ecosystem.

## Features

- Role-based Access Control (RBAC): Admin, Advisor, Executive, and Student roles
- Event Lifecycle Management: Draft, Advisor review, Approved, and Completed
- Attendance Verification: Dynamic rotating QR tokens with offline batch sync support
- Cryptographic Credentials: ECDSA P-256 signed tamper-evident PDF certificates and public verification portal
- Automated Attainment Tracking: Co-curricular transcripts with Program Outcome (PO) mapping

## Project Structure

```text
codes/
├── client/          # Vite + React 18 + TypeScript + Tailwind CSS
├── server/          # Express + TypeScript + SQLite
├── docker-compose.yml
├── package.json     # Monorepo workspace configuration
└── README.md
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` in `server/` to `.env`:

```bash
cp server/.env.example server/.env
```

### 3. Run Development Servers

```bash
npm run dev
```

- Client runs at: `http://localhost:5173`
- Server runs at: `http://localhost:5000`

### 4. Build and Test

```bash
npm run build
npm run test
```

## Authors & Contributors

- **Team Leader:** Md. Shakhawat Hossain (Sakib) | Department of CSE | Batch 54
- **Team Member:** Fahim Hossain | Department of CSE
- **Course Teacher:** Al Imtiaz | Department of Computer Science and Engineering
