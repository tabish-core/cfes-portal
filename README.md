# cfes-portal
### Iqra University — Final Year Project | MERN Stack

---

## Full Folder Structure

```
cfes-portal/
│
├── client/                             ← React + Vite (Frontend)
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   │   └── axios.js                ← Axios instance + JWT interceptor
│   │   ├── assets/                     ← Images, fonts, logos
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── Button.jsx          ← Reusable button (primary/secondary/danger)
│   │   │   │   ├── Input.jsx           ← Reusable form input with error display
│   │   │   │   ├── Modal.jsx           ← Generic modal wrapper
│   │   │   │   └── StatusBadge.jsx     ← draft | submitted | approved | rejected chip
│   │   │   └── layout/
│   │   │       ├── Sidebar.jsx         ← Role-aware nav sidebar
│   │   │       └── Topbar.jsx          ← Page title + user info + logout
│   │   ├── context/
│   │   │   └── AuthContext.jsx         ← Global auth state (user, token, login, logout)
│   │   ├── hooks/
│   │   │   ├── useAuth.js              ← Consumes AuthContext
│   │   │   └── useFetch.js             ← Generic fetch hook (loading/error/data)
│   │   ├── layouts/
│   │   │   ├── AdminLayout.jsx         ← Sidebar + Topbar + <Outlet /> for admin
│   │   │   └── FacultyLayout.jsx       ← Sidebar + Topbar + <Outlet /> for faculty
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   └── Login.jsx           ← Login page
│   │   │   ├── admin/
│   │   │   │   ├── Dashboard.jsx       ← Stats + recent activity
│   │   │   │   ├── Submissions.jsx     ← Review / approve / reject course files
│   │   │   │   └── Users.jsx           ← Manage faculty accounts
│   │   │   └── faculty/
│   │   │       ├── Dashboard.jsx       ← Own submissions table + Drive links
│   │   │       └── CourseForm.jsx      ← 6-step multi-step form → PDF → Drive
│   │   ├── routes/
│   │   │   ├── ProtectedRoute.jsx      ← Redirects unauthenticated → /login
│   │   │   └── RoleRoute.jsx           ← Redirects wrong role → own dashboard
│   │   ├── services/
│   │   │   ├── auth.service.js         ← login(), logout() API calls
│   │   │   └── courseFile.service.js   ← submit, list, review API calls
│   │   ├── App.jsx                     ← Full routing tree (React Router v6)
│   │   ├── main.jsx                    ← React DOM entry point
│   │   └── index.css                   ← Global styles
│   ├── .env.example                    ← VITE_API_BASE_URL
│   ├── package.json
│   └── vite.config.js                  ← Proxy /api → :5000, runs on :3000
│
├── server/                             ← Node.js + Express (Backend)
│   ├── config/
│   │   ├── db.js                       ← Mongoose connection
│   │   ├── env.js                      ← dotenv loader + validation
│   │   └── googleDrive.js              ← Google Drive API client (Service Account)
│   ├── controllers/
│   │   ├── auth.controller.js          ← register, login, logout handlers
│   │   ├── course.controller.js        ← Course CRUD handlers
│   │   ├── courseFile.controller.js    ← Submit, list, review handlers
│   │   └── user.controller.js          ← Admin user management handlers
│   ├── middlewares/
│   │   ├── auth.middleware.js          ← verifyToken middleware
│   │   ├── errorHandler.middleware.js  ← Centralised error response
│   │   └── role.middleware.js          ← requireRole(...roles) guard
│   ├── models/
│   │   ├── Course.model.js             ← title, code, creditHours, semester, dept
│   │   ├── CourseFile.model.js         ← formData, status, driveFileId, driveFileUrl
│   │   └── User.model.js              ← name, email, password, role, department
│   ├── routes/
│   │   ├── auth.routes.js             ← /api/auth/*
│   │   ├── course.routes.js           ← /api/courses/*
│   │   ├── courseFile.routes.js       ← /api/course-files/*
│   │   └── user.routes.js             ← /api/users/*
│   ├── services/
│   │   ├── auth.service.js            ← BCrypt, JWT generation, token verify
│   │   ├── courseFile.service.js      ← Orchestrator: PDF → Drive → DB
│   │   ├── document.service.js        ← Puppeteer + Handlebars → PDF
│   │   └── drive.service.js           ← uploadFile, getFileUrl, deleteFile
│   ├── utils/
│   │   ├── logger.js                  ← Timestamped console logger
│   │   └── response.js                ← sendSuccess / sendError helpers
│   ├── .env.example                   ← PORT, MONGO_URI, JWT_SECRET, DRIVE_FOLDER_ID
│   ├── package.json
│   └── server.js                      ← Express entry point
│
├── directives/                         ← SOPs (AGENTS.md layer 1)
├── execution/                          ← Utility scripts (AGENTS.md layer 3)
├── .tmp/                               ← Temp files (generated PDFs before upload)
├── .env                                ← Root secrets (not committed)
├── .gitignore
└── AGENTS.md
```

---

## API Routes Reference

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/register` | Public | Register new user |
| POST | `/api/auth/login` | Public | Login, returns JWT |
| POST | `/api/auth/logout` | Auth | Logout |
| GET | `/api/users` | Admin | List all faculty |
| PUT | `/api/users/:id` | Admin | Update user (toggle active, etc.) |
| DELETE | `/api/users/:id` | Admin | Delete user |
| GET | `/api/courses` | Auth | List courses |
| POST | `/api/courses` | Admin | Create course |
| PUT | `/api/courses/:id` | Admin | Update course |
| DELETE | `/api/courses/:id` | Admin | Delete course |
| POST | `/api/course-files` | Faculty | Submit course file (triggers PDF + Drive) |
| GET | `/api/course-files/my` | Faculty | Get own submissions |
| GET | `/api/course-files` | Admin | Get all submissions |
| PUT | `/api/course-files/:id/review` | Admin | Approve or reject with comment |

---

## Setup & Installation

### Prerequisites
- Node.js ≥ 18
- MongoDB running locally (`mongod`) or a MongoDB Atlas URI
- Google Cloud Service Account `credentials.json` (for Drive upload)

---

### 1. Clone / open the project
```bash
cd "d:\cfes-portal"
```

### 2. Backend setup
```bash
cd server

# Copy the env template and fill in your values
copy .env.example .env

# Install dependencies
npm install

# Start dev server (nodemon, hot-reload)
npm run dev
# → Running at http://localhost:5000
```

### 3. Frontend setup
```bash
cd ../client

# Copy the env template
copy .env.example .env

# Install dependencies
npm install

# Start dev server (Vite, hot-reload)
npm run dev
# → Running at http://localhost:3000
# → /api requests proxied to http://localhost:5000
```

---

## Environment Variables

### `server/.env`
| Variable | Example | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Express server port |
| `MONGO_URI` | `mongodb://localhost:27017/course_file_db` | MongoDB connection string |
| `JWT_SECRET` | `supersecret123` | JWT signing key |
| `JWT_EXPIRES_IN` | `7d` | Token expiry |
| `GOOGLE_DRIVE_FOLDER_ID` | `1AbCdEfGhIj...` | Shared Drive folder ID |
| `NODE_ENV` | `development` | Environment |

### `client/.env`
| Variable | Example | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:5000/api` | Base URL for Axios (not needed if using proxy) |

---

## Key Dependencies

### Backend (`server/`)
| Package | Purpose |
|---------|---------|
| `express` | HTTP framework |
| `mongoose` | MongoDB ODM |
| `jsonwebtoken` | JWT auth |
| `bcryptjs` | Password hashing |
| `puppeteer` | Headless Chrome → PDF generation |
| `handlebars` | HTML template engine for PDF |
| `googleapis` | Google Drive API v3 |
| `multer` | Multipart file handling |
| `helmet` | HTTP security headers |
| `morgan` | Request logging |
| `cors` | Cross-origin resource sharing |
| `dotenv` | Environment variable loader |
| `nodemon` | Dev hot-reload |

### Frontend (`client/`)
| Package | Purpose |
|---------|---------|
| `react` + `react-dom` | UI framework |
| `react-router-dom` | Client-side routing |
| `axios` | HTTP client with interceptors |
| `vite` | Build tool & dev server |

---

## Development Workflow

```
[Faculty]                          [Backend]                    [Google Drive]
   │                                   │                              │
   │── Fill multi-step form ──────────▶│                              │
   │                              Validate + save draft               │
   │── Click Submit ────────────────▶  │                              │
   │                              Generate PDF (Puppeteer)            │
   │                              Upload PDF ────────────────────────▶│
   │                              Save driveFileId + URL              │
   │                              Status: submitted                   │
   │◀── Response (Drive link) ─────────│                              │
   │                                   │                              │
[Admin]                                │                              │
   │── Review submission ────────────▶ │                              │
   │── Approve / Reject + comment ───▶ │                              │
   │                              Status updated                      │
   │◀── Confirmation ──────────────────│                              │
```

---

## Next Steps (Phase 1)
Start coding in this order:
1. `server/config/db.js` — Mongoose connection
2. `server/models/User.model.js` — User schema
3. `server/services/auth.service.js` — bcrypt + JWT
4. `server/controllers/auth.controller.js` — register + login
5. `server/routes/auth.routes.js` — wire routes
6. `server/server.js` — bootstrap Express
7. `client/src/context/AuthContext.jsx` — global auth state
8. `client/src/pages/auth/Login.jsx` — login UI
