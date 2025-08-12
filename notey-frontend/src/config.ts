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
    LABELS: "/labels",
    LABEL_ATTACH: (labelId: string) => `/labels/${labelId}/attach`,
    LABEL_DETACH: (labelId: string) => `/labels/${labelId}/detach`,
    BULK_LABEL_ATTACH: "/labels/bulk-attach",
    BULK_LABEL_DETACH: "/labels/bulk-detach",
  }
};

export default config;
