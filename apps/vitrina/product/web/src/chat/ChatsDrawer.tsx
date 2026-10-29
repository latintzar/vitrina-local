import { useEffect, useMemo, useState } from 'react';
import { deleteThread, listThreads, patchThread, type ChatThread } from './threadsApi';

function labelFor(thread: ChatThread) {
  return thread.title?.trim() || 'Untitled chat';
}

function groupLabel(thread: ChatThread) {
  if (thread.pinned) return 'Pinned';
  const raw = thread.updated_at || thread.created_at;
  if (!raw) return 'Recent';
  const dt = new Date(raw);
  const ageMs = Date.now() - dt.getTime();
  if (ageMs < 7 * 24 * 60 * 60 * 1000) return 'This week';
  return dt.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function ChatsDrawer({
  open,
  onClose,
  onNewChat,
  onThreadsLoaded,
}: {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onThreadsLoaded?: (threads: ChatThread[]) => void;
}) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const rows = await listThreads();
      setThreads(rows);
      onThreadsLoaded?.(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'threads_failed');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  const grouped = useMemo(() => {
    const groups = new Map<string, ChatThread[]>();
    for (const thread of threads) {
      const key = groupLabel(thread);
      groups.set(key, [...(groups.get(key) || []), thread]);
    }
    return [...groups.entries()];
  }, [threads]);

  async function togglePin(thread: ChatThread) {
    await patchThread(thread.id, { pinned: !thread.pinned });
    await refresh();
  }

  async function rename(thread: ChatThread) {
    const title = window.prompt('Rename chat', labelFor(thread));
    if (!title) return;
    await patchThread(thread.id, { title });
    await refresh();
  }

  async function remove(thread: ChatThread) {
    if (!window.confirm(`Delete "${labelFor(thread)}"?`)) return;
    await deleteThread(thread.id);
    await refresh();
  }

  return (
    <>
      <div className={`vitrina-drawer-scrim ${open ? 'is-open' : ''}`} onClick={onClose} />
      <aside className={`vitrina-chats-drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <header className="vitrina-drawer-head">
          <div>
            <p>Conversations</p>
            <h2>Chats</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close chats">
            x
          </button>
        </header>

        <button type="button" className="vitrina-new-chat" onClick={onNewChat}>
          + New chat
        </button>

        {busy ? <p className="vitrina-drawer-muted">Loading chats...</p> : null}
        {error ? <p className="vitrina-drawer-error">Could not load chats.</p> : null}
        {!busy && !error && threads.length === 0 ? (
          <p className="vitrina-drawer-muted">No chats yet. Ask Vitrina for dinner, tools, or a shop nearby.</p>
        ) : null}

        <div className="vitrina-thread-groups">
          {grouped.map(([group, rows]) => (
            <section key={group}>
              <h3>{group}</h3>
              {rows.map((thread) => (
                <article key={thread.id} className="vitrina-thread-row">
                  <button type="button" className="vitrina-thread-main" onClick={onClose}>
                    <strong>{labelFor(thread)}</strong>
                    <span>{thread.updated_at ? new Date(thread.updated_at).toLocaleString() : 'New'}</span>
                  </button>
                  <div className="vitrina-thread-actions">
                    <button type="button" onClick={() => void togglePin(thread)}>
                      {thread.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button type="button" onClick={() => void rename(thread)}>
                      Rename
                    </button>
                    <button type="button" onClick={() => void remove(thread)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </div>

        <style>{`
          .vitrina-drawer-scrim {
            position: fixed;
            inset: 0;
            z-index: 49;
            background: rgba(20, 29, 45, 0.18);
            opacity: 0;
            pointer-events: none;
            transition: opacity 180ms ease;
          }
          .vitrina-drawer-scrim.is-open {
            opacity: 1;
            pointer-events: auto;
          }
          .vitrina-chats-drawer {
            position: fixed;
            inset: 0 auto 0 0;
            z-index: 50;
            width: min(380px, calc(100vw - 28px));
            display: flex;
            flex-direction: column;
            gap: 14px;
            padding: max(18px, env(safe-area-inset-top)) 16px 18px;
            box-sizing: border-box;
            background: color-mix(in srgb, var(--color-card) 94%, white);
            border-right: 1px solid var(--color-border);
            box-shadow: 24px 0 80px -56px rgba(31, 75, 150, 0.55);
            transform: translateX(-102%);
            transition: transform 220ms ease;
          }
          .vitrina-chats-drawer.is-open {
            transform: translateX(0);
          }
          .vitrina-drawer-head {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-start;
          }
          .vitrina-drawer-head p,
          .vitrina-drawer-head h2 {
            margin: 0;
          }
          .vitrina-drawer-head p {
            color: var(--color-ink-light);
            font-size: 0.82rem;
          }
          .vitrina-drawer-head h2 {
            font-family: var(--font-display);
            font-size: 2rem;
            letter-spacing: -0.04em;
          }
          .vitrina-drawer-head button,
          .vitrina-thread-actions button {
            border: 1px solid var(--color-border);
            border-radius: var(--r, 6px);
            background: var(--color-card);
            color: var(--color-ink);
            font: inherit;
            cursor: pointer;
          }
          .vitrina-drawer-head button {
            width: 34px;
            height: 34px;
          }
          .vitrina-new-chat {
            min-height: 42px;
            border: none;
            border-radius: var(--r, 6px);
            background: var(--color-ink);
            color: var(--color-card);
            font: inherit;
            cursor: pointer;
          }
          .vitrina-drawer-muted,
          .vitrina-drawer-error {
            margin: 0;
            color: var(--color-ink-light);
            line-height: 1.45;
          }
          .vitrina-drawer-error {
            color: #9f331f;
          }
          .vitrina-thread-groups {
            display: flex;
            flex-direction: column;
            gap: 18px;
            overflow-y: auto;
            padding-right: 2px;
          }
          .vitrina-thread-groups h3 {
            margin: 0 0 8px;
            color: var(--color-ink-light);
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .vitrina-thread-row {
            padding: 10px;
            border-radius: var(--r, 6px);
            background: color-mix(in srgb, var(--color-cream) 74%, white);
            border: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
          }
          .vitrina-thread-main {
            width: 100%;
            display: grid;
            gap: 4px;
            padding: 0;
            border: none;
            background: transparent;
            text-align: left;
            color: var(--color-ink);
            font: inherit;
            cursor: pointer;
          }
          .vitrina-thread-main strong {
            font-size: 0.96rem;
          }
          .vitrina-thread-main span {
            color: var(--color-ink-light);
            font-size: 0.78rem;
          }
          .vitrina-thread-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 10px;
          }
          .vitrina-thread-actions button {
            min-height: 28px;
            padding: 0 8px;
            color: var(--color-ink-light);
            font-size: 0.78rem;
          }
        `}</style>
      </aside>
    </>
  );
}
