# Complete Deployment Guide - Daan Darpan Application

## Free Hosting Solution: Render.com + Supabase

This guide will help you deploy your full-stack application (Frontend + Backend + Database) for **FREE** on secure, reliable platforms.

---

## 🎯 Overview

- **Frontend**: Deployed on **Render.com** (Static Site)
- **Backend**: Deployed on **Render.com** (Web Service)
- **Database**: Hosted on **Supabase** (PostgreSQL - Free Tier)
- **Cost**: $0/month
- **SSL**: Included (HTTPS)
- **Reliability**: 99.9% uptime

---

## 📋 Prerequisites

1. GitHub account (free)
2. Render.com account (free signup)
3. Supabase account (free signup)
4. Git installed on your computer

---

## 🗂️ PART 1: Prepare Your Code

### Step 1.1: Initialize Git Repository

```bash
cd "/Users/aashijain/Downloads/AccountMasterLedger 3"
git init
```

### Step 1.2: Create .gitignore File

Create a file named `.gitignore` in the root directory with this content:

```
node_modules/
dist/
.env
.env.local
.DS_Store
uploads/*.jpg
uploads/*.png
uploads/*.pdf
uploads/*.xlsx
uploads/*.csv
!uploads/.gitkeep
*.log
.vscode/
.idea/
```

### Step 1.3: Create Production Environment File Template

Create `.env.example` file:

```
DATABASE_URL=postgresql://user:password@host:port/database
NODE_ENV=production
PORT=5001
SESSION_SECRET=your-super-secret-session-key-change-this
SENDGRID_API_KEY=optional-for-email-backup
```

### Step 1.4: Update package.json Scripts

Edit `package.json` and add these scripts:

```json
{
  "scripts": {
    "dev": "tsx server/index.ts",
    "build": "npm run build:client && npm run build:server",
    "build:client": "vite build",
    "build:server": "tsc --project tsconfig.server.json",
    "start": "NODE_ENV=production node dist/index.js",
    "db:push": "drizzle-kit push"
  }
}
```

### Step 1.5: Create Server TypeScript Config

Create `tsconfig.server.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "CommonJS",
    "outDir": "./dist",
    "rootDir": "./server",
    "noEmit": false
  },
  "include": ["server/**/*"],
  "exclude": ["node_modules"]
}
```

### Step 1.6: Commit Your Code

```bash
git add .
git commit -m "Initial commit - Ready for deployment"
```

---

## 🗄️ PART 2: Setup Database (Supabase)

### Step 2.1: Create Supabase Account

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub (recommended) or email
4. Verify your email

### Step 2.2: Create New Project

1. Click "New Project"
2. Fill in details:
   - **Name**: `daan-darpan-db`
   - **Database Password**: Create a strong password (SAVE THIS!)
   - **Region**: Choose closest to India (e.g., Singapore, Mumbai)
   - **Pricing Plan**: Free
3. Click "Create new project"
4. Wait 2-3 minutes for database to initialize

### Step 2.3: Get Database Connection String

1. In Supabase dashboard, click "Settings" (gear icon)
2. Click "Database" in left sidebar
3. Scroll to "Connection string"
4. Select "URI" tab
5. Copy the connection string
6. Replace `[YOUR-PASSWORD]` with the password you created
7. **Save this connection string** - you'll need it!

Example: `postgresql://postgres:yourpassword@db.xxxxx.supabase.co:5432/postgres`

### Step 2.4: Run Database Schema

1. In Supabase dashboard, click "SQL Editor"
2. Click "New query"
3. Copy and paste the entire contents of `db/schema.sql` from your project
4. Click "Run" or press Ctrl+Enter
5. Verify: Click "Table Editor" - you should see all tables created

---

## 🚀 PART 3: Deploy Backend (Render.com)

### Step 3.1: Push Code to GitHub

1. Create new repository on GitHub:
   - Go to https://github.com/new
   - Name: `daan-darpan`
   - Visibility: **Private** (recommended for security)
   - Don't initialize with README
   - Click "Create repository"

2. Push your code:
```bash
git remote add origin https://github.com/YOUR-USERNAME/daan-darpan.git
git branch -M main
git push -u origin main
```

### Step 3.2: Create Render Account

1. Go to https://render.com
2. Click "Get Started"
3. Sign up with GitHub (recommended)
4. Authorize Render to access your repositories

### Step 3.3: Deploy Backend Web Service

1. In Render dashboard, click "New +" → "Web Service"
2. Connect your `daan-darpan` repository
3. Configure service:
   - **Name**: `daan-darpan-backend`
   - **Environment**: `Node`
   - **Region**: Choose closest to database (e.g., Singapore)
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build:server`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

4. Click "Advanced" and add Environment Variables:
   - `DATABASE_URL` = Your Supabase connection string
   - `NODE_ENV` = `production`
   - `SESSION_SECRET` = Generate random string (at least 32 characters)
   - `PORT` = `5001`

5. Click "Create Web Service"
6. Wait 5-10 minutes for deployment
7. **Save your backend URL**: `https://daan-darpan-backend.onrender.com`

### Step 3.4: Verify Backend is Running

1. Visit: `https://daan-darpan-backend.onrender.com/api/auth/user`
2. You should see: `{"message":"Not authenticated"}`
3. If you see this, backend is working! ✅

---

## 🌐 PART 4: Deploy Frontend (Render.com)

### Step 4.1: Update Frontend API URLs

1. Edit `client/src/lib/api.ts` or wherever API base URL is defined
2. Replace `http://localhost:5001` with your backend URL
3. Commit and push:
```bash
git add .
git commit -m "Update API URL for production"
git push
```

### Step 4.2: Create Build Script for Static Site

Add this to `package.json` if not already present:

```json
{
  "scripts": {
    "build:static": "vite build --outDir dist/client"
  }
}
```

### Step 4.3: Deploy Frontend Static Site

1. In Render dashboard, click "New +" → "Static Site"
2. Connect your `daan-darpan` repository
3. Configure:
   - **Name**: `daan-darpan-frontend`
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build:client`
   - **Publish Directory**: `dist/client`

4. Click "Create Static Site"
5. Wait 5 minutes for deployment
6. **Save your frontend URL**: `https://daan-darpan-frontend.onrender.com`

---

## 📊 PART 5: Import Existing Data

### Step 5.1: Backup Current Data

On your local machine:

```bash
# Export all data as JSON
curl http://localhost:5001/api/database/backup -o backup_data.xlsx
```

### Step 5.2: Import Data via Supabase

**Option 1: Using Excel Backup**
1. Login to your deployed app as admin
2. Go to Settings → Backup & Restore
3. Upload the `backup_data.xlsx` file
4. Click "Restore from Excel"

**Option 2: Manual SQL Import**
1. In Supabase dashboard → SQL Editor
2. Create new query
3. Copy data insert statements from your local database
4. Run the query

---

## 🔐 PART 6: Security & Configuration

### Step 6.1: Update CORS Settings

Edit `server/index.ts` to allow your frontend domain:

```typescript
app.use(cors({
  origin: [
    'https://daan-darpan-frontend.onrender.com',
    'http://localhost:5173' // for local development
  ],
  credentials: true
}));
```

### Step 6.2: Setup Environment Variables Correctly

In Render backend service:
1. Go to Environment tab
2. Verify all variables are set:
   - ✅ DATABASE_URL
   - ✅ SESSION_SECRET
   - ✅ NODE_ENV=production

### Step 6.3: Enable Auto-Deploy

In Render dashboard:
1. Go to Settings
2. Enable "Auto-Deploy" from main branch
3. Now every git push will auto-deploy!

---

## ✅ PART 7: Testing & Verification

### Step 7.1: Test Complete Flow

1. Visit your frontend URL
2. Login with admin credentials
3. Test creating a user
4. Test creating an entry
5. Test viewing reports
6. Test database backup

### Step 7.2: Performance Check

- Frontend should load in < 3 seconds
- API responses should be < 1 second
- Database queries should be < 500ms

---

## 🆘 Troubleshooting

### Issue: "Database connection failed"
**Fix**: 
1. Check DATABASE_URL in Render environment variables
2. Verify Supabase database is active
3. Check if IP whitelist is disabled in Supabase (Settings → Database → Connection pooling)

### Issue: "CORS error in browser"
**Fix**:
1. Update CORS origin in `server/index.ts`
2. Add both frontend URLs (with and without www)
3. Redeploy backend

### Issue: "Build failed"
**Fix**:
1. Check build logs in Render dashboard
2. Verify all dependencies in package.json
3. Check Node version (use LTS version)

### Issue: "App is slow on free tier"
**Note**: Free tier has limitations:
- Backend sleeps after 15 mins of inactivity
- First request after sleep takes 30-60 seconds
- Upgrade to paid tier ($7/month) for always-on service

---

## 📝 Maintenance Commands

### Update Application

```bash
# On your local machine
git add .
git commit -m "Your update message"
git push
# Render will auto-deploy!
```

### Backup Database

```bash
# Visit your app and go to Settings → Backup
# Or use this API call:
curl https://daan-darpan-backend.onrender.com/api/database/backup -o backup.xlsx
```

### View Logs

1. Go to Render dashboard
2. Click on your service
3. Click "Logs" tab
4. See real-time logs

---

## 💰 Cost Breakdown

| Service | Plan | Cost |
|---------|------|------|
| Render Frontend | Free | $0/month |
| Render Backend | Free | $0/month |
| Supabase Database | Free (500MB) | $0/month |
| **Total** | | **$0/month** |

### Free Tier Limits

- **Render**: 750 hours/month, sleeps after 15 min inactivity
- **Supabase**: 500MB database, 2GB bandwidth, unlimited API requests
- **Perfect for**: Small to medium applications, up to 1000 daily users

---

## 🎉 Success Checklist

- [ ] Code pushed to GitHub
- [ ] Supabase database created and schema loaded
- [ ] Backend deployed on Render (URL working)
- [ ] Frontend deployed on Render (app loads)
- [ ] Can login with admin account
- [ ] Can create users and entries
- [ ] Data persists after page refresh
- [ ] Backup/restore works

---

## 📞 Support & Resources

- **Render Documentation**: https://render.com/docs
- **Supabase Documentation**: https://supabase.com/docs
- **Check Service Status**:
  - Render: https://status.render.com
  - Supabase: https://status.supabase.com

---

## 🔒 Security Best Practices

1. ✅ Never commit `.env` files to GitHub
2. ✅ Use strong SESSION_SECRET (generate with: `openssl rand -hex 32`)
3. ✅ Keep repository Private on GitHub
4. ✅ Use strong database password
5. ✅ Enable 2FA on all accounts (GitHub, Render, Supabase)
6. ✅ Regular backups (weekly recommended)
7. ✅ Keep dependencies updated (`npm audit fix`)

---

## 📅 Recommended Schedule

- **Daily**: Monitor application performance
- **Weekly**: Download database backup
- **Monthly**: Update dependencies, review logs
- **Quarterly**: Review and update security settings

---

**Deployment Date**: _______________  
**Backend URL**: _______________  
**Frontend URL**: _______________  
**Database Host**: _______________  

---

*End of Deployment Guide*
