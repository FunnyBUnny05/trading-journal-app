// ─── Core entry — just a timestamp + free-form text ────────────────────────

export interface JournalEntry {
  id: string;
  timestamp: string;   // ISO 8601
  text: string;        // whatever the user typed
}

// ─── AI Feedback (Managed Analyst) ──────────────────────────────────────────

export interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export interface AIFeedback {
  generated_at: string;
  entries_analyzed: number;
  content: ContentBlock[];
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'err';
