# Google Docs Integration Setup

This guide explains how to set up Google Docs integration for Notey.

## Prerequisites

1. Google Cloud Console project with Google Docs API and Google Drive API enabled
2. OAuth 2.0 credentials configured

## Setup Steps

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google Docs API
   - Google Drive API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Configure OAuth consent screen if not done already
6. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:8000/integrations/callback/google` (for development)

### 2. Environment Variables

Add the following environment variables to your `.env` file:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:8000/integrations/callback/google

# Frontend URL (for OAuth redirects)
FRONTEND_URL=http://localhost:3000
```

### 3. Database Migration

Run the database migration to create the user integrations table:

```sql
-- Run the migration file: migrations/005_user_integrations.sql
```

### 4. Install Dependencies

Make sure the following dependencies are installed:

```bash
pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib
```

## API Endpoints

### Authentication Flow

1. **GET `/integrations/auth/google`** - Initiate OAuth flow
2. **GET `/integrations/callback/google`** - Handle OAuth callback
3. **GET `/integrations/status`** - Check integration status
4. **DELETE `/integrations/disconnect/google_docs`** - Disconnect integration

### Export Endpoints

1. **POST `/chat/export/google-docs`** - Export chat report to Google Docs
2. **POST `/integrations/export/google-docs`** - Generic export endpoint

## Usage Flow

1. User clicks "Connect Google Docs" in frontend
2. Frontend calls `/integrations/auth/google`
3. User is redirected to Google OAuth consent screen
4. After consent, Google redirects to `/integrations/callback/google`
5. Backend stores OAuth tokens and redirects to frontend
6. User can now export reports to Google Docs using export endpoints

## Security Notes

- OAuth tokens are stored securely in the database with RLS policies
- Tokens are automatically refreshed when expired
- Users can only access their own integration tokens
- All API calls require valid Supabase authentication

## Testing

Use the provided test interface at `/test-google-docs.html` to test the integration flow.
