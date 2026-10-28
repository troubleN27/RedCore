import type { StateStorage } from 'zustand/middleware';

/** localStorage может быть недоступен (приватный режим, запрет cookies) — тогда без сохранения. */
export const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* хранилище недоступно — состояние живёт до перезагрузки */
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};
