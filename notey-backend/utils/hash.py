# Hashing utilities
import hashlib

def generate_event_hash(user_id: str, event_number: int) -> str:
    raw = f"{user_id}-{event_number}"
    hashed = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return hashed[:16]  # shorten for readability, or keep full if you prefer
