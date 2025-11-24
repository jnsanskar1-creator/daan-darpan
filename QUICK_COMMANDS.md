# Quick Commands Reference

Copy and paste these commands during deployment.

## 📋 Git Commands

### Push to GitHub (First Time)
```bash
cd "/Users/aashijain/Downloads/AccountMasterLedger 3/DaanDarpan-Production"
git remote add origin https://github.com/YOUR-USERNAME/daan-darpan.git
git branch -M main
git push -u origin main
```

### Update Code Later
```bash
cd "/Users/aashijain/Downloads/AccountMasterLedger 3/DaanDarpan-Production"
git add .
git commit -m "Update application"
git push
```

## 🔐 Generate Session Secret

Run this command to generate a secure random session secret:

```bash
openssl rand -hex 32
```

Copy the output and use it as your `SESSION_SECRET` environment variable.

## 🗄️ Database Schema

Location of your database schema file:
```
/Users/aashijain/Downloads/AccountMasterLedger 3/db/schema.sql
```

You'll paste the contents of this file into Supabase SQL Editor.

## 🌐 Environment Variables for Render

Copy these and fill in your actual values:

### Backend Environment Variables:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
NODE_ENV=production
PORT=5001
SESSION_SECRET=your-generated-secret-from-openssl-command
```

## 📦 Render Configuration

### Backend Service Settings:
- **Name**: `daan-darpan-backend`
- **Environment**: Node
- **Branch**: main
- **Build Command**: `npm install && npm run build:server`
- **Start Command**: `npm start`
- **Instance Type**: Free

### Frontend Static Site Settings:
- **Name**: `daan-darpan-frontend`
- **Branch**: main  
- **Build Command**: `npm install && npm run build:client`
- **Publish Directory**: `dist/client`

## 🔄 Update Frontend API URL

After deploying backend, update this file:

**File**: `client/src/lib/queryClient.ts` or similar

**Find**:
```typescript
const baseURL = 'http://localhost:5001';
```

**Replace with**:
```typescript
const baseURL = 'https://daan-darpan-backend.onrender.com';
```

Then commit and push:
```bash
git add .
git commit -m "Update API URL for production"
git push
```

## 📊 Database Connection Test

Test your database connection from Supabase:
1. Go to Supabase Dashboard
2. Click "SQL Editor"
3. Run: `SELECT COUNT(*) FROM users;`
4. Should return existing user count

## 🚨 Troubleshooting Commands

### View Git Status
```bash
cd "/Users/aashijain/Downloads/AccountMasterLedger 3/DaanDarpan-Production"
git status
```

### View Git Commits
```bash
git log --oneline
```

### Check if Git Remote is Set
```bash
git remote -v
```

### Remove Wrong Remote
```bash
git remote remove origin
```

## 📱 URLs to Save

After deployment, save these URLs:

```
Frontend URL: https://daan-darpan-frontend.onrender.com
Backend URL: https://daan-darpan-backend.onrender.com
GitHub Repo: https://github.com/YOUR-USERNAME/daan-darpan
Supabase Project: https://supabase.com/dashboard/project/YOUR-PROJECT-ID
```

## 🔧 Local Build Test (Optional)

Test the production build locally before deploying:

```bash
cd "/Users/aashijain/Downloads/AccountMasterLedger 3/DaanDarpan-Production"
npm install
npm run build
# If successful, you'll see dist folder created
```

## 📥 Download Backup

From your deployed app:
```bash
curl -o backup.xlsx https://daan-darpan-backend.onrender.com/api/database/backup
```

---

**Tip**: Keep this file open in a text editor during deployment for quick copy-paste!
