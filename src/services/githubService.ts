import type { JournalEntry } from '../types/trade';

const PAT    = import.meta.env.VITE_GITHUB_PAT as string;
const REPO   = import.meta.env.VITE_GITHUB_REPO as string;
const BRANCH = (import.meta.env.VITE_GITHUB_BRANCH as string) || 'main';
const BASE   = 'https://api.github.com';
const LOCAL_KEY = 'trading_journal_entries';

function headers() {
  return {
    Authorization: `Bearer ${PAT}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

function toB64(s: string) { return btoa(unescape(encodeURIComponent(s))); }
function fromB64(s: string) { return decodeURIComponent(escape(atob(s))); }

async function getSHA(path: string): Promise<string | undefined> {
  const r = await fetch(`${BASE}/repos/${REPO}/contents/${path}?ref=${BRANCH}`, { headers: headers() });
  if (r.status === 404) return undefined;
  if (!r.ok) throw new Error(`GitHub GET ${path}: ${r.status}`);
  return ((await r.json()) as { sha: string }).sha;
}

// Each entry is its own file: entries/<ISO-date>_<id>.json
function path(e: JournalEntry) {
  return `entries/${e.timestamp.slice(0, 10)}_${e.id}.json`;
}

export async function saveEntry(entry: JournalEntry): Promise<void> {
  // 1. Always save locally first so data is never lost
  const local = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  local.push(entry);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(local));

  // 2. Sync to GitHub optionally 
  if (!PAT || !REPO) return;
  const p = path(entry);
  const sha = await getSHA(p);
  const body: Record<string, unknown> = {
    message: `journal ${entry.timestamp.slice(0, 10)}`,
    content: toB64(JSON.stringify(entry)),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const r = await fetch(`${BASE}/repos/${REPO}/contents/${p}`, {
    method: 'PUT', headers: headers(), body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`GitHub save: ${r.status} ${await r.text()}`);
}

export async function loadEntries(): Promise<JournalEntry[]> {
  const local = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') as JournalEntry[];

  if (!PAT || !REPO) {
    return local.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  try {
    const r = await fetch(`${BASE}/repos/${REPO}/contents/entries?ref=${BRANCH}`, { headers: headers() });
    if (r.status === 404) return local;
    if (!r.ok) throw new Error(`GitHub list: ${r.status}`);
    const files = (await r.json()) as { name: string; download_url: string }[];
    const remote = await Promise.all(
      files.filter(f => f.name.endsWith('.json')).map(async f => {
        const res = await fetch(f.download_url);
        return JSON.parse(await res.text()) as JournalEntry;
      })
    );

    // Merge local and remote
    const merged = new Map<string, JournalEntry>();
    local.forEach(e => merged.set(e.id, e));
    remote.forEach(e => merged.set(e.id, e));
    
    const final = Array.from(merged.values());
    localStorage.setItem(LOCAL_KEY, JSON.stringify(final));
    return final.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  } catch (err) {
    console.error("GitHub sync failed, falling back to local storage", err);
    return local.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
}

// Keep getRawFile for debug
export async function getRawFile(path: string): Promise<string> {
  const r = await fetch(`${BASE}/repos/${REPO}/contents/${path}?ref=${BRANCH}`, { headers: headers() });
  if (!r.ok) throw new Error(`${r.status}`);
  const d = (await r.json()) as { content: string };
  return fromB64(d.content.replace(/\n/g, ''));
}
