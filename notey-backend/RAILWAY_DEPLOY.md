# Railway Deployment Guide for Notey Backend

## Quick Deploy to Railway

1. **Fork/Clone this repository** to your GitHub account

2. **Connect to Railway:**
   - Go to [Railway](https://railway.app)
   - Sign up/in with GitHub
   - Click "Deploy from GitHub repo"
   - Select your Notey repository
   - Choose the `notey-backend` folder as the root

3. **Set Environment Variables in Railway:**
   ```
   SUPABASE_URL=https://fwtyenzchbxbbzhsohan.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3dHllbnpjaGJ4YmJ6aHNvaGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MDM2NjEsImV4cCI6MjA3MDA3OTY2MX0.xGQl_uYfFnozmg-HPOD5BYa3yOhFq68V4gBPyBBbPYQ
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3dHllbnpjaGJ4YmJ6aHNvaGFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDUwMzY2MSwiZXhwIjoyMDcwMDc5NjYxfQ.ei3-x-mvQ7WEZhXAHT8tE9Ow7YJU-YwF0z1aY2VQQOA
   WHISPER_URL=https://notey-whisper.fly.dev/transcribe
   GOOGLE_API_KEY=AIzaSyBgEe9VYM-mjNyY_eouZIJtec0E3DFzOcc
   ENVIRONMENT=production
   ```

4. **Deploy:**
   - Railway will automatically detect the Python app
   - It will install dependencies from `requirements.txt`
   - The app will start using the command in `Procfile`

5. **Get your Railway URL:**
   - After deployment, Railway will provide a URL like: `https://your-app.railway.app`
   - Use this URL in your frontend configuration

## Update Frontend

After deployment, update your frontend's environment variables:

**For Vercel (Frontend):**
Add this environment variable in Vercel dashboard:
```
VITE_BACKEND_URL=https://your-railway-app.railway.app
```

**For Local Development:**
Update your frontend `.env` file:
```
VITE_BACKEND_URL=https://your-railway-app.railway.app
```

## Health Check

Your deployed backend will be available at:
- `https://your-app.railway.app/` (Health check)
- `https://your-app.railway.app/health` (Health status)
- `https://your-app.railway.app/docs` (API documentation)

## Troubleshooting

1. **Build Fails:** Check Railway logs for dependency issues
2. **App Crashes:** Verify all environment variables are set
3. **CORS Issues:** Make sure your frontend URL is added to the CORS origins in `main.py`

## Production Optimization

- The app uses uvicorn with optimized settings for production
- CORS is configured for your specific frontend domains
- Health check endpoints are available for monitoring
- Logs are available in Railway dashboard
