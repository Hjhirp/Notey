# 🎙️ Notey - AI-Powered Audio Note Taking Platform

> A modern, full-stack audio recording and transcription platform with photo timeline integration and AI-powered summarization.

![Notey Architecture](./docs/architecture.svg)

## 📋 Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Services Architecture](#services-architecture)
- [API Documentation](#api-documentation)
- [Setup Instructions](#setup-instructions)
- [Deployment](#deployment)
- [Contributing](#contributing)

## 🎯 Overview

Notey is a comprehensive audio note-taking platform that enables users to:

- **Record audio** with real-time transcription
- **Capture photos** with precise timeline synchronization
- **Generate AI summaries** using Google Gemini
- **Replay sessions** with synchronized media
- **Manage events** with user authentication

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   React Web     │    │   FastAPI       │    │   Whisper.cpp   │
│   Frontend      │◄──►│   Backend       │◄──►│   Service       │
│                 │    │                 │    │   (Fly.io)      │
│   - Recording   │    │   - API Routes  │    │                 │
│   - Photo Cap   │    │   - Auth        │    │   - Audio       │
│   - Timeline    │    │   - Storage     │    │     Transcription│
│   - Replay      │    │   - AI Summary  │    │   - File I/O    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │            |         │                       
         │          |           │                       
         ▼        ▼             ▼                       
┌─────────────────┐    ┌─────────────────┐              
│                 │    │                 │              
│   Supabase      │    │   Google        │              
│   Platform      │    │   Gemini AI     │              
│                 │    │                 │              
│   - Database    │    │   - Text        │              
│   - Storage     │    │     Summarization│              
│   - Auth        │    │   - Content     │              
│   - Real-time   │    │     Generation  │              
│                 │    │                 │              
└─────────────────┘    └─────────────────┘              
```

### Data Flow Architecture

```
Recording Session:
User → Frontend → Audio Capture → Backend API → Supabase Storage
                    ↓
              Photo Capture → Backend API → Supabase Storage
                    ↓
           Background: Audio → Whisper Service → Transcription
                    ↓
              Transcription → Google Gemini → AI Summary
                    ↓
              Summary → Backend → Supabase Database

Replay Session:
User → Frontend → Load Event → Backend API → Supabase Database
                    ↓
              Audio + Photos + Timeline → Synchronized Playback
```

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 19 with TypeScript
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **State Management**: React Hooks
- **Authentication**: Supabase Auth
- **HTTP Client**: Fetch API

### Backend
- **Framework**: FastAPI (Python)
- **Authentication**: Supabase JWT
- **Database**: Supabase PostgreSQL
- **File Storage**: Supabase Storage
- **AI Services**: Google Gemini 2.0
- **Audio Processing**: FFmpeg

### Transcription Service
- **Engine**: Whisper.cpp
- **Runtime**: Python FastAPI
- **Deployment**: Fly.io Docker
- **Models**: OpenAI Whisper base.en

### Infrastructure
- **Database**: Supabase PostgreSQL
- **File Storage**: Supabase Storage (S3-compatible)
- **Authentication**: Supabase Auth
- **Transcription**: Fly.io (Docker containers)
- **AI Processing**: Google Gemini API

## 🏛️ Services Architecture

### 1. Frontend Service (React App)

```
src/
├── components/
│   ├── Auth.tsx           # User authentication
│   ├── Events.tsx         # Event management
│   ├── Navbar.tsx         # Navigation
│   ├── PhotoButton.tsx    # Photo capture
│   ├── PhotoTimelinePlayer.tsx  # Photo timeline
│   ├── Recorder.tsx       # Audio recording
│   └── Replay.tsx         # Session replay
├── lib/
│   └── supabase.ts        # Supabase client
└── main.tsx               # App entry point
```

**Key Features:**
- Real-time audio recording with WebRTC
- Photo capture with timeline synchronization
- Event-driven architecture
- Responsive design with Tailwind CSS

### 2. Backend Service (FastAPI)

```
src/
├── routes.py              # API endpoints
├── database.py            # Database operations
├── config.py              # Configuration
├── summarizer.py          # AI summarization
└── transcribe_summary.py  # Transcription pipeline

services/
├── auth.py                # Authentication
├── storage.py             # File storage
└── tasks.py               # Background tasks

models/
└── schemas.py             # Data models
```

**API Endpoints:**
- `POST /events/start` - Create new recording event
- `POST /events/{id}/audio` - Upload audio files
- `POST /events/{id}/photo` - Upload photos with timing
- `GET /events/{id}` - Get event details
- `POST /summarize` - Generate AI summary
- `POST /transcribe-summary` - Full transcription pipeline

### 3. Whisper Transcription Service

```
whisper-server/
├── app.py                 # FastAPI transcription service
├── Dockerfile             # Container configuration
├── fly.toml               # Fly.io deployment
└── whisper.cpp/           # Whisper.cpp integration
```

**Features:**
- High-performance audio transcription
- Support for multiple audio formats
- Robust error handling and fallbacks
- Optimized for long-form audio

## 📡 API Documentation

### Core Endpoints

#### Events Management
```http
POST /events/start
Content-Type: application/json
Authorization: Bearer <supabase_jwt>

{
  "title": "Meeting Notes"
}

Response: {
  "event_id": "uuid",
  "unique_hash": "hash"
}
```

#### Audio Upload
```http
POST /events/{event_id}/audio
Content-Type: multipart/form-data

file: <audio_file>
duration: <number>

Response: {
  "status": "audio uploaded",
  "audio_url": "https://..."
}
```

#### Photo Upload
```http
POST /events/{event_id}/photo
Content-Type: multipart/form-data
Authorization: Bearer <supabase_jwt>

file: <image_file>
offset: <number>

Response: {
  "status": "photo uploaded",
  "photo_url": "https://...",
  "offset": <number>
}
```

#### Transcription
```http
POST /transcribe
Content-Type: application/json

{
  "url": "https://audio-file-url"
}

Response: {
  "transcript": "transcribed text"
}
```

#### AI Summarization
```http
POST /summarize
Content-Type: application/json

{
  "transcript": "text to summarize"
}

Response: {
  "summary": "ai generated summary"
}
```

### Database Schema

```sql
-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  unique_hash TEXT UNIQUE,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);

-- Audio chunks table
CREATE TABLE audio_chunks (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  start_time FLOAT NOT NULL,
  length FLOAT NOT NULL,
  audio_url TEXT NOT NULL,
  transcript TEXT,
  summary TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Photos table
CREATE TABLE photos (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  offset FLOAT NOT NULL,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🚀 Setup Instructions

### Prerequisites
- Node.js 18+
- Python 3.9+
- Docker (for Whisper service)
- Supabase account
- Google AI API key

### 1. Clone Repository
```bash
git clone <repository-url>
cd Notey
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Fill in your API keys and URLs
# See .env.example for detailed instructions
```

### 3. Frontend Setup
```bash
cd notey-frontend
npm install
npm run dev
```

### 4. Backend Setup
```bash
cd notey-backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### 5. Whisper Service Setup
```bash
cd notey-fly/whisper-server
# Deploy to Fly.io
fly deploy
```

### Environment Variables Required

See `.env.example` for complete list. Key variables:

```bash
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key

# Frontend
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:8000

# AI Services
GOOGLE_API_KEY=your_gemini_api_key
WHISPER_URL=https://your-whisper-service.fly.dev/transcribe
```

## 🌐 Deployment

### Development
```bash
# Frontend (localhost:5173)
cd notey-frontend && npm run dev

# Backend (localhost:8000)
cd notey-backend && uvicorn main:app --reload
```

### Production

#### Frontend
- Deploy to Vercel, Netlify, or similar
- Set environment variables in deployment platform

#### Backend
- Deploy to Railway, Render, or similar FastAPI hosting
- Set production environment variables

#### Whisper Service
```bash
cd notey-fly/whisper-server
fly deploy
```

## 🧪 Testing

```bash
# Backend tests
cd notey-backend
python -m pytest

# Frontend tests
cd notey-frontend
npm test
```

## 🔒 Security Features

- **JWT Authentication** via Supabase
- **File Upload Validation** (size, type, security)
- **CORS Configuration** for cross-origin requests
- **Environment Variable Security** (no secrets in code)
- **API Rate Limiting** (configurable)

## 📊 Performance Optimizations

- **Lazy Loading** of components and media
- **Audio Compression** before upload
- **Image Optimization** for photos
- **Background Processing** for transcription
- **Caching** of API responses
- **GPU Acceleration** for Whisper transcription

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🐛 Known Issues

- Large audio files (>50MB) may timeout on slow connections
- Real-time transcription has ~2-3 second delay
- Photo synchronization requires stable internet connection

## 🔮 Roadmap

- [ ] Tag-Based Notes Searching and Similar Notes Recommendations
- [ ] Notes Sharing and Real-time collaborative editing
- [ ] Mobile app (React Native)
- [ ] Advanced AI features (sentiment analysis, key points)
- [ ] Export to various formats (PDF, DOCX, etc.)
- [ ] Integration with calendar apps
- [ ] Offline mode support

---

**Built with ❤️ by the Notey Team**

For support, please create an issue in this repository.
