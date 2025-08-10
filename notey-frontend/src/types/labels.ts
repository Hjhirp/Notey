export interface Label {
  id: string;
  name: string;
  color: string;
  icon: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface LabelCreateRequest {
  name: string;
  color: string;
  icon: string;
}

export interface LabelUpdateRequest {
  name?: string;
  color?: string;
  icon?: string;
}

export interface LabelLink {
  id: string;
  label_id: string;
  entity_type: 'audio_chunk' | 'event' | 'photo';
  entity_id: string;
  created_at: string;
}

export interface LabelWithCount extends Label {
  usage_count: number;
}

export interface BulkAttachRequest {
  label_ids: string[];
  entity_type: 'audio_chunk' | 'event' | 'photo';
  entity_ids: string[];
}
