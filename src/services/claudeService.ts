import type { JournalEntry, AIFeedback, ContentBlock } from '../types/trade';

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string;
const ENV_ID  = import.meta.env.VITE_ANTHROPIC_ENV_ID as string;
const MODEL   = (import.meta.env.VITE_CLAUDE_MODEL as string) || 'claude-3-7-sonnet-20250219';
const API_URL = 'https://api.anthropic.com/v1/messages';

const SYSTEM = `You are a quantitative trading analyst with access to pandas and matplotlib.
You are given a raw journal of trading logs.
Analyze the patterns, compute simple metrics if possible, and plot a chart of the trader's emotional state, frequency of trades, or theoretical returns over time.
Do not format as strict JSON. Provide a clear, brief textual summary in markdown, and at least one relevant chart using matplotlib. Save all charts as PNG and output them. Keep your text analysis brutal and to the point.`;

const EVAL_SYSTEM = `You are a strict, objective Risk Manager evaluating a proposed trade.
You are given a raw journal of the trader's history.
The trader is proposing a NEW trade.
Read their entire journal history. Tell them exactly why this proposed trade will likely succeed or fail based on their specific past mistakes or successes. Look for recurring patterns.
Provide a clear, brief textual assessment and give a final GO or NO-GO decision. Output native markdown.`;

function format(entries: JournalEntry[]): string {
  return entries.map((e, i) =>
    `[${i + 1}] ${new Date(e.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}:\n${e.text}`
  ).join('\n\n');
}

export async function analyze(entries: JournalEntry[]): Promise<AIFeedback> {
  if (!API_KEY) throw new Error('VITE_ANTHROPIC_API_KEY not set in .env');
  if (!ENV_ID) throw new Error('VITE_ANTHROPIC_ENV_ID not set. Please run the init-env.js script first.');

  const userMsg = `Here are ${entries.length} journal entries from a trader:\n\n${format(entries)}\n\nGive me your statistical and behavioral assessment. Output charts inline.`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'managed-agents-2026-04-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      environment: { id: ENV_ID },
      messages: [{ role: 'user', content: userMsg }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json() as { content: ContentBlock[] };

  return { generated_at: new Date().toISOString(), entries_analyzed: entries.length, report_type: 'analysis', content: data.content };
}

export async function evaluateTrade(entries: JournalEntry[], proposedTrade: string): Promise<AIFeedback> {
  if (!API_KEY) throw new Error('VITE_ANTHROPIC_API_KEY not set in .env');
  if (!ENV_ID) throw new Error('VITE_ANTHROPIC_ENV_ID not set. Please run the init-env.js script first.');

  const userMsg = `Here are ${entries.length} journal entries from the trader:\n\n${format(entries)}\n\nTHE PROPOSED TRADE:\n"${proposedTrade}"\n\nGive me your final GO or NO-GO pre-trade evaluation based on my history.`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'managed-agents-2026-04-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system: EVAL_SYSTEM,
      environment: { id: ENV_ID },
      messages: [{ role: 'user', content: userMsg }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json() as { content: ContentBlock[] };

  return { generated_at: new Date().toISOString(), entries_analyzed: entries.length, report_type: 'eval', content: data.content };
}
