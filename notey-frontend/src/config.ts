// Configuration for the frontend app
export const config = {
  BACKEND_URL: import.meta.env.VITE_BACKEND_URL || "http://localhost:8000",
  API_ENDPOINTS: {
    EVENTS: "/events",
    START_EVENT: "/events/start",
    UPLOAD_AUDIO: (eventId: string) => `/events/${eventId}/audio`,
    UPLOAD_PHOTO: (eventId: string) => `/events/${eventId}/photo`,
    DELETE_EVENT: (eventId: string) => `/events/${eventId}`,
    AUDIO_CHUNKS: "/audio-chunks",
  }
};

export default config;
