# Deployment Checklist

Use this checklist while deploying your application.

## ✅ Pre-Deployment

- [ ] Create GitHub account (https://github.com/join)
- [ ] Create Render account (https://render.com - Sign up with GitHub)
- [ ] Create Supabase account (https://supabase.com)
- [ ] Install Git on your system (if not already installed)

## ✅ GitHub Setup

- [ ] Create new repository on GitHub named `daan-darpan`
- [ ] Set repository to **Private**
- [ ] Copy the repository URL (e.g., `https://github.com/YOUR-USERNAME/daan-darpan.git`)
- [ ] Run: `git remote add origin YOUR-REPO-URL`
- [ ] Run: `git push -u origin main`
- [ ] Verify code is visible on GitHub

## ✅ Database Setup (Supabase)

- [ ] Create new project: `daan-darpan-db`
- [ ] Choose region: Singapore or closest to India
- [ ] Save database password in a secure place
- [ ] Wait for database to initialize (2-3 minutes)
- [ ] Go to Settings → Database → Connection string
- [ ] Copy URI connection string
- [ ] Replace `[YOUR-PASSWORD]` with your actual password
- [ ] Save this connection string securely
- [ ] Go to SQL Editor
- [ ] Create new query
- [ ] Paste schema from `/Users/aashijain/Downloads/AccountMasterLedger 3/db/schema.sql`
- [ ] Run the query
- [ ] Verify tables created in Table Editor

## ✅ Backend Deployment (Render)

- [ ] Go to Render dashboard
- [ ] Click "New +" → "Web Service"
- [ ] Connect GitHub repository
- [ ] Service Name: `daan-darpan-backend`
- [ ] Environment: `Node`
- [ ] Build Command: `npm install && npm run build:server`
- [ ] Start Command: `npm start`
- [ ] Instance Type: **Free**
- [ ] Add Environment Variables:
  - [ ] `DATABASE_URL` = Your Supabase connection string
  - [ ] `NODE_ENV` = `production`
  - [ ] `SESSION_SECRET` = (Generate random 32+ character string)
  - [ ] `PORT` = `5001`
- [ ] Click "Create Web Service"
- [ ] Wait for deployment (5-10 minutes)
- [ ] Copy backend URL: `https://daan-darpan-backend.onrender.com`
- [ ] Test URL: Visit `https://your-backend.onrender.com/api/auth/user`
- [ ] Should see: `{"message":"Not authenticated"}` ✅

## ✅ Frontend Deployment (Render)

- [ ] Update API URL in code (see DEPLOYMENT_GUIDE.md)
- [ ] Commit and push changes to GitHub
- [ ] Go to Render dashboard
- [ ] Click "New +" → "Static Site"
- [ ] Connect GitHub repository
- [ ] Service Name: `daan-darpan-frontend`
- [ ] Build Command: `npm install && npm run build:client`
- [ ] Publish Directory: `dist/client`
- [ ] Click "Create Static Site"
- [ ] Wait for deployment (3-5 minutes)
- [ ] Copy frontend URL: `https://daan-darpan-frontend.onrender.com`
- [ ] Visit URL - app should load ✅

## ✅ Data Import

- [ ] Login to deployed app as admin
- [ ] Go to Settings → Backup & Restore
- [ ] Upload latest backup file
- [ ] Click Restore
- [ ] Verify data loaded correctly

## ✅ Final Testing

- [ ] Open deployed app URL
- [ ] Login with admin credentials
- [ ] Create a test user
- [ ] Create a test entry
- [ ] View reports
- [ ] Test backup/export
- [ ] All features working ✅

## ✅ Post-Deployment

- [ ] Save all URLs in a secure document:
  - [ ] Frontend URL: _______________
  - [ ] Backend URL: _______________
  - [ ] Database URL: _______________
  - [ ] GitHub Repo: _______________
- [ ] Enable Auto-Deploy in Render settings
- [ ] Setup weekly backup schedule
- [ ] Share app URL with team

## 🎉 Complete!

Your application is now live and accessible to anyone with the URL!

---

**Deployment Date**: _______________
**Deployed By**: _______________
**Status**: _______________
