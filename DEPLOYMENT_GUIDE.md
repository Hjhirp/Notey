# 🚀 Notey Deployment Guide

## Backend Deployment on Railway

### Step 1: Prepare the Repository
Ensure your backend files are ready with these Railway-specific configurations:
- ✅ `Procfile` - Tells Railway how to start the app
- ✅ `requirements.txt` - Python dependencies
- ✅ `runtime.txt` - Python version specification
- ✅ `railway.json` - Railway deployment configuration
- ✅ `.railwayignore` - Files to exclude from deployment

### Step 2: Deploy to Railway

1. **Go to [Railway](https://railway.app)**
2. **Sign up/Sign in** with GitHub
3. **Create a new project** → "Deploy from GitHub repo"
4. **Select your repository** and choose the `notey-backend` folder
5. **Set Environment Variables** in Railway dashboard:
   ```
   SUPABASE_URL=https://fwtyenzchbxbbzhsohan.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3dHllbnpjaGJ4YmJ6aHNvaGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MDM2NjEsImV4cCI6MjA3MDA3OTY2MX0.xGQl_uYfFnozmg-HPOD5BYa3yOhFq68V4gBPyBBbPYQ
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3dHllbnpjaGJ4YmJ6aHNvaGFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDUwMzY2MSwiZXhwIjoyMDcwMDc5NjYxfQ.ei3-x-mvQ7WEZhXAHT8tE9Ow7YJU-YwF0z1aY2VQQOA
   WHISPER_URL=https://notey-whisper.fly.dev/transcribe
   GOOGLE_API_KEY=AIzaSyBgEe9VYM-mjNyY_eouZIJtec0E3DFzOcc
   ENVIRONMENT=production
   ```

6. **Deploy** - Railway will automatically build and deploy your app

### Step 3: Get Your Railway URL
After deployment, you'll get a URL like: `https://your-app-name.railway.app`

**Test your deployment:**
- Health check: `https://your-app-name.railway.app/`
- API docs: `https://your-app-name.railway.app/docs`

---

## Frontend Updates After Backend Deployment

### Step 4: Update Frontend Configuration

1. **Update Vercel Environment Variables:**
   ```
   VITE_BACKEND_URL=https://your-app-name.railway.app
   ```

2. **Update Local Development .env:**
   ```
   VITE_BACKEND_URL=https://your-app-name.railway.app
   ```

3. **Update CORS in Backend:**
   Add your Vercel frontend URL to the CORS origins in `main.py` (already configured for Vercel domains)

### Step 5: Redeploy Frontend
- Push changes to trigger Vercel rebuild
- Verify the frontend can connect to your Railway backend

---

## Quick Deployment Commands

### For Railway Backend:
```bash
# No commands needed - just push to GitHub and connect to Railway
git add .
git commit -m "Configure Railway deployment"
git push origin main
```

### For Frontend (if using config approach):
```bash
# Build and test locally first
npm run build
# Then deploy via Vercel dashboard or:
vercel --prod
```

---

## Production URLs Structure

**Backend (Railway):** `https://your-app-name.railway.app`
- API endpoints: `/events`, `/events/start`, etc.
- Health check: `/health`
- Documentation: `/docs`

**Frontend (Vercel):** `https://your-frontend.vercel.app`
- Will connect to Railway backend via VITE_BACKEND_URL

**External Services:**
- Whisper: `https://notey-whisper.fly.dev/transcribe`
- Supabase: `https://fwtyenzchbxbbzhsohan.supabase.co`

---

## Troubleshooting

### Backend Issues:
1. **Build fails:** Check Railway logs for Python dependency issues
2. **App crashes:** Verify all environment variables are set correctly
3. **CORS errors:** Ensure frontend URL is in the allowed origins

### Frontend Issues:
1. **Can't connect to backend:** Check VITE_BACKEND_URL environment variable
2. **Build fails:** Run `npm run build` locally to test first

### Testing:
1. **Backend health:** `curl https://your-app-name.railway.app/health`
2. **Frontend build:** `npm run build` in frontend directory
3. **End-to-end:** Test recording a note through the frontend

---

## Environment Variables Summary

### Railway (Backend):
```
SUPABASE_URL=https://fwtyenzchbxbbzhsohan.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
WHISPER_URL=https://notey-whisper.fly.dev/transcribe
GOOGLE_API_KEY=AIzaSyBgEe9VYM-mjNyY_eouZIJtec0E3DFzOcc
ENVIRONMENT=production
```

### Vercel (Frontend):
```
VITE_SUPABASE_URL=https://fwtyenzchbxbbzhsohan.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_BACKEND_URL=https://your-app-name.railway.app
```

✅ **Your Notey app is now ready for production!**
