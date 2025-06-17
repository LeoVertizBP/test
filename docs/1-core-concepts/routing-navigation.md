# Routing & Navigation

## Overview

This document covers how routing is handled in both the backend API server and the frontend web application.

## Backend API Routing

### Implementation

*   **Framework:** Express.js is used as the backend web framework.
*   **Structure:** API routes are defined within the `src/routes/` directory. Typically, each major resource or feature area (e.g., users, scans, rules) will have its own route file.
*   **Express Router:** These route files likely utilize `express.Router()` to define specific endpoints (e.g., `/api/v1/scans`, `/api/v1/rules/:id`) and associate them with HTTP methods (GET, POST, PUT, DELETE).
*   **Controllers/Services:** Route handlers within these files typically delegate the actual request processing logic to controller functions or methods within the Service layer (`src/services/`).
*   **Middleware:** Middleware functions (`src/middleware/`) are likely used for cross-cutting concerns like authentication (`authMiddleware.ts`), request validation, and logging before the main route handler is executed.
*   **Registration:** The main application file (`src/app.ts` or `src/server.ts`) imports and registers these routers, often under a base path like `/api/v1`.

### Example Structure (Conceptual)

```
src/
├── app.ts / server.ts  # Registers base routes
├── routes/
│   ├── index.ts        # Combines all routers
│   ├── scanRoutes.ts   # Defines /api/v1/scans/* endpoints
│   ├── ruleRoutes.ts   # Defines /api/v1/rules/* endpoints
│   └── authRoutes.ts   # Defines /api/v1/auth/* endpoints
└── services/
    ├── scanJobService.ts # Handles logic for scan routes
    └── ...
```

## Frontend Routing & Navigation

### Implementation

*   **Framework:** Next.js is used for the frontend.
*   **Router:** The **App Router** is used, indicated by the presence of the `frontend/src/app/` directory.
*   **File-System Based Routing:** Routes are defined by the folder structure within `frontend/src/app/`. Each folder represents a URL segment.
    *   A special file named `page.tsx` (or `.js`, `.jsx`) within a folder makes that path publicly accessible and defines the UI for that route.
    *   Dynamic routes are created using folders with square brackets, e.g., `app/scans/[scanId]/page.tsx` would handle routes like `/scans/123`.
    *   Layout files (`layout.tsx`) define shared UI structures for segments and their children.
*   **Navigation:**
    *   **`<Link>` Component:** The primary way to navigate between routes declaratively within React components is using the `next/link` component. This enables client-side navigation without a full page reload.
    *   **`useRouter` Hook:** For programmatic navigation (e.g., after a form submission), the `useRouter` hook (imported from `next/navigation` in the App Router) provides methods like `router.push('/new-path')`.
*   **Route Handlers:** API endpoints can also be defined within the Next.js frontend project itself using Route Handlers (files named `route.ts` or `.js` within the `app/` directory, often under an `api/` subfolder like `app/api/proxy/route.ts`). These are typically used for backend-for-frontend (BFF) patterns, proxying requests, or simple API tasks directly within the Next.js app, distinct from the main backend API.

### Example Structure (Conceptual App Router)

```
frontend/src/app/
├── layout.tsx          # Root layout
├── page.tsx            # UI for the homepage ('/')
├── dashboard/
│   ├── layout.tsx      # Layout specific to /dashboard/* routes
│   └── page.tsx        # UI for '/dashboard'
├── scans/
│   ├── page.tsx        # UI for '/scans' (e.g., list scans)
│   └── [scanId]/       # Dynamic route for individual scans
│       └── page.tsx    # UI for '/scans/:scanId'
└── api/                # Frontend API routes (Route Handlers)
    └── auth/
        └── route.ts    # Example: /api/auth endpoint handled by Next.js
```

## Integration Points

*   **Frontend -> Backend:** The frontend application uses its routing system to display different pages/views. Components within these pages make API calls (using `axios` via frontend services) to the backend API routes to fetch or modify data.
*   **Next.js `<Link>` / `useRouter`:** Handle client-side transitions between frontend routes.
*   **Express Router (Backend):** Handles incoming API requests from the frontend (or other clients).

## Best Practices

*   **Backend:** Keep API routes focused on handling HTTP requests/responses and delegate business logic to services. Use consistent naming conventions and URL structures (e.g., RESTful principles). Implement proper authentication and authorization middleware.
*   **Frontend:** Leverage the App Router's features like Server Components for data fetching where appropriate. Use the `<Link>` component for standard navigation and `useRouter` for programmatic navigation. Organize routes logically using the file system.
