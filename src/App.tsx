import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from './store/journalStore';
import type { AIFeedback, JournalEntry } from './types/trade';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function today() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

// ─── Rendered Lines ───────────────────────────────────────────────────────────

type Line =
  | { kind: 'boot'; text: string }
  | { kind: 'entry'; entry: JournalEntry }
  | { kind: 'divider' }
  | { kind: 'feedback'; feedback: AIFeedback }
  | { kind: 'info'; text: string }
  | { kind: 'err'; text: string };

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const { entries, feedback, analyzing, sync, syncMsg, load, add, runAnalysis, clearFeedback } = useStore();
  const [draft, setDraft] = useState('');
  const [booted, setBooted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Boot ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    load().then(() => setBooted(true));
  }, [load]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, feedback, analyzing]);

  // ── Auto-grow textarea ──────────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 260)}px`;
  }, [draft]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleKey = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter alone → submit; Shift+Enter → newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = draft.trim();
      if (!text) return;
      // Commands
      if (text === '/analyze') { runAnalysis(); setDraft(''); return; }
      if (text === '/clear')   { clearFeedback(); setDraft(''); return; }
      if (text === '/help') {
        setDraft('');
        return; // help rendered statically
      }
      add(text);
      setDraft('');
    }
  }, [draft, add, runAnalysis, clearFeedback]);

  // ── Build lines to render ───────────────────────────────────────────────────
  const lines: Line[] = [];

  lines.push({ kind: 'boot', text: `TRADING JOURNAL  //  ${today()}` });
  lines.push({ kind: 'boot', text: 'Type your trade notes and press Enter to save.' });
  lines.push({ kind: 'boot', text: 'Commands:  /analyze · /clear · Shift+Enter for new line' });
  lines.push({ kind: 'divider' });

  if (booted && entries.length === 0 && sync !== 'syncing') {
    lines.push({ kind: 'info', text: 'No entries yet. Start typing above.' });
  }

  entries.forEach(e => lines.push({ kind: 'entry', entry: e }));

  if (feedback) {
    lines.push({ kind: 'divider' });
    lines.push({ kind: 'feedback', feedback });
    lines.push({ kind: 'divider' });
  }

  // ── Sync status line ─────────────────────────────────────────────────────────
  const syncColor =
    sync === 'ok'  ? 'clr-green' :
    sync === 'err' ? 'clr-red'   :
    sync === 'syncing' ? 'clr-amber' : 'clr-dim';

  return (
    <div className="term-root" onClick={() => textareaRef.current?.focus()}>
      {/* ── Title bar ────────────────────────────────────────────────────── */}
      <div className="term-titlebar">
        <div className="term-dots">
          <span className="dot dot-red" />
          <span className="dot dot-amber" />
          <span className="dot dot-green" />
        </div>
        <span className="term-title">trading-journal</span>
        <span className={`term-sync ${syncColor}`}>{syncMsg || sync}</span>
      </div>

      {/* ── Output area ──────────────────────────────────────────────────── */}
      <div className="term-output">
        {lines.map((line, i) => {
          if (line.kind === 'divider') return <div key={i} className="term-divider" />;
          if (line.kind === 'boot')   return <p key={i} className="term-boot">{line.text}</p>;
          if (line.kind === 'info')   return <p key={i} className="term-info">{line.text}</p>;
          if (line.kind === 'err')    return <p key={i} className="term-err">{line.text}</p>;
          if (line.kind === 'entry')  return <EntryLine key={line.entry.id} entry={line.entry} />;
          if (line.kind === 'feedback') return <FeedbackBlock key={i} feedback={line.feedback} onClear={clearFeedback} />;
          return null;
        })}

        {/* Analyzing spinner */}
        {analyzing && (
          <p className="term-analyzing">
            <span className="blink">▋</span> analyzing {entries.length} entries…
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input row ────────────────────────────────────────────────────── */}
      <div className="term-input-row">
        <span className="term-prompt">›</span>
        <textarea
          ref={textareaRef}
          className="term-textarea"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder={analyzing ? 'analyzing…' : 'what happened today?'}
          disabled={analyzing}
          rows={1}
          autoFocus
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// ─── Entry Line ───────────────────────────────────────────────────────────────

function EntryLine({ entry }: { entry: JournalEntry }) {
  return (
    <div className="term-entry">
      <span className="entry-ts">{fmtDate(entry.timestamp)}</span>
      <pre className="entry-text">{entry.text}</pre>
    </div>
  );
}

// ─── Feedback Block ───────────────────────────────────────────────────────────

function FeedbackBlock({ feedback, onClear }: { feedback: AIFeedback; onClear: () => void }) {
  return (
    <div className="term-feedback">
      <p className="fb-header">
        ── ANALYST REPORT · {feedback.entries_analyzed} entries ·{' '}
        {new Date(feedback.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        <button className="fb-clear" onClick={onClear}>clear</button>
      </p>

      {feedback.content?.map((block, i) => {
        if (block.type === 'image' && block.source?.data) {
          return (
            <img 
              key={i} 
              src={`data:${block.source.media_type};base64,${block.source.data}`} 
              alt="Data Analysis Chart" 
              className="fb-chart"
            />
          );
        }
        if (block.type === 'text' && block.text) {
          return (
            <div key={i} className="fb-text">
              {block.text}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
