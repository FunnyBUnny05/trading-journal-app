import { create } from 'zustand';
import type { JournalEntry, AIFeedback, SyncStatus } from '../types/trade';
import { saveEntry, loadEntries } from '../services/githubService';
import { analyze } from '../services/claudeService';

function uid() { return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }

interface Store {
  entries: JournalEntry[];
  feedback: AIFeedback | null;
  analyzing: boolean;
  sync: SyncStatus;
  syncMsg: string;

  load: () => Promise<void>;
  add: (text: string) => Promise<void>;
  runAnalysis: () => Promise<void>;
  clearFeedback: () => void;
}

export const useStore = create<Store>((set, get) => ({
  entries: [],
  feedback: null,
  analyzing: false,
  sync: 'idle',
  syncMsg: '',

  load: async () => {
    set({ sync: 'syncing', syncMsg: 'loading…' });
    try {
      const entries = await loadEntries();
      set({ entries, sync: 'ok', syncMsg: `${entries.length} entries loaded` });
    } catch (e: unknown) {
      set({ sync: 'err', syncMsg: e instanceof Error ? e.message : 'load failed' });
    }
  },

  add: async (text: string) => {
    const entry: JournalEntry = { id: uid(), timestamp: new Date().toISOString(), text: text.trim() };
    set(s => ({ entries: [...s.entries, entry], sync: 'syncing', syncMsg: 'saving…' }));
    try {
      await saveEntry(entry);
      set({ sync: 'ok', syncMsg: 'saved' });
    } catch (e: unknown) {
      set({ sync: 'err', syncMsg: e instanceof Error ? e.message : 'save failed' });
    }
  },

  runAnalysis: async () => {
    const { entries } = get();
    if (!entries.length) return;
    set({ analyzing: true, feedback: null });
    try {
      const feedback = await analyze(entries);
      set({ feedback, analyzing: false });
    } catch (e: unknown) {
      set({ analyzing: false, sync: 'err', syncMsg: e instanceof Error ? e.message : 'analysis failed' });
    }
  },

  clearFeedback: () => set({ feedback: null }),
}));
