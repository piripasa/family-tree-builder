export type History<T> = {
  past: T[];
  future: T[];
};

const HISTORY_LIMIT = 30;

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [] };
}

export function pushHistory<T>(history: History<T>, current: T): History<T> {
  return { past: [...history.past, current].slice(-HISTORY_LIMIT), future: [] };
}

export function undoHistory<T>(history: History<T>, current: T): { history: History<T>; value: T } | null {
  const value = history.past.at(-1);
  if (value === undefined) return null;
  return { value, history: { past: history.past.slice(0, -1), future: [...history.future, current] } };
}

export function redoHistory<T>(history: History<T>, current: T): { history: History<T>; value: T } | null {
  const value = history.future.at(-1);
  if (value === undefined) return null;
  return { value, history: { past: [...history.past, current], future: history.future.slice(0, -1) } };
}
