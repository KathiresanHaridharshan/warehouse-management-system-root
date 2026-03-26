# Warehouse Material Management System (IST Support)

A full-stack 3-layer architecture prototype for tracking warehouse pallets with a modern dark-themed dashboard and **Indian Standard Time (IST)** transaction logging.

## Deployment Instructions (Monorepo)

This project is configured as a monorepo. **Do NOT set the root directory to `client`.**

### Frontend & Backend (Vercel)
Vercel will automatically detect the configuration from the root `vercel.json`.

1.  **Import**: Import this repository.
2.  **Root Directory**: Keep as `./` (Default).
3.  **Build Command**: `npm run build` (Root command).
4.  **Output Directory**: `client/dist`.
5.  **Deploy**: Click deploy.

### Frontend (Netlify)
Netlify will automatically detect the configuration from the root `netlify.toml`.

1.  **Import**: Import this repository.
2.  **Build Command**: `npm run build`.
3.  **Publish directory**: `client/dist`.
4.  **Deploy**: Click deploy. The `_redirects` file handles SPA routing.

> [!IMPORTANT]
> Because this is a Full-Stack application, the backend is included. For production data persistence beyond serverless limits, host the `/server` on a dedicated Node.js platform (Render/Railway).

## Local Setup
1.  **Install all**: `npm run install-all` (from root)
2.  **Backend**: `cd server && npm start`
3.  **Frontend**: `cd client && npm run dev`

