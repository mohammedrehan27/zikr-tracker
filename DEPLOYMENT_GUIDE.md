# Deployment Guide for Ibadah Tracker

This application is ready for simple 1-click deployment on cloud hosts like **Render.com** or **Railway.app**.

---

## 🚀 Option 1: Deploy on Render.com (Easiest)

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Ibadah Tracker"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/ibadah-tracker.git
   git push -u origin main
   ```

2. **Log in to [Render.com](https://render.com)** and click **New + > Web Service**.
3. Connect your GitHub repository.
4. Configure the settings:
   - **Name**: `ibadah-tracker`
   - **Runtime**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
5. **Add Environment Variables**:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: *(Generate any random 32+ character string)*
   - `DB_FILE`: `/var/data/zikr.db` *(If attaching a Render persistent disk)*
6. **(Optional but recommended for 10-15 users)**:
   - In Render, scroll down to **Disks** and attach a Persistent Disk:
     - Name: `data`
     - Mount Path: `/var/data`
     - Size: `1 GB` (only ~$1/month or use standard storage)
7. Click **Deploy Web Service**!

Render will build both the frontend and backend, and give you a free HTTPS URL like:
👉 `https://ibadah-tracker.onrender.com`

---

## 🚆 Option 2: Deploy on Railway.app

1. Go to [railway.app](https://railway.app) and click **New Project > Deploy from GitHub repo**.
2. Select your repository.
3. In **Settings**:
   - Build Command: `npm run build`
   - Start Command: `npm start`
4. In **Variables**, add:
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = `any_strong_secret_key_here`
5. Click **Add Volume** to mount a disk for `zikr.db` so data persists across re-deployments.
6. Under **Networking**, click **Generate Domain**.

---

## 🔒 Important Security Notes for Production
- Make sure `JWT_SECRET` is set to a long private string in the hosting provider dashboard.
- Since it serves over HTTPS on Render/Railway, cookies are automatically secured.

