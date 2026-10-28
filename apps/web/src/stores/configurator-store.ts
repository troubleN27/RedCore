'use client';

import { isListSlot, type PcComponentType } from '@redcore/domain';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BuildItem } from '@/features/configurator/types';
import { safeStorage } from './safe-storage';

// Черновик сборки живёт в localStorage: можно закрыть вкладку и вернуться.
// Цены, характеристики и совместимость всегда берутся из каталога, здесь — только slug и количество.

export const MAX_LIST_QTY = 8;

interface ConfiguratorState {
  items: BuildItem[];
  activeSlot: PcComponentType;
  /** publicId последней сохранённой версии; сбрасывается при любом изменении состава */
  savedId: string | null;
  place: (slot: PcComponentType, slug: string) => void;
  remove: (slot: PcComponentType, slug?: string) => void;
  setQty: (slot: PcComponentType, slug: string, qty: number) => void;
  setActiveSlot: (slot: PcComponentType) => void;
  load: (items: BuildItem[], savedId: string | null) => void;
  markSaved: (publicId: string) => void;
  clear: () => void;
}

export const useConfiguratorStore = create<ConfiguratorState>()(
  persist(
    (set, get) => ({
      items: [],
      activeSlot: 'case',
      savedId: null,

      place: (slot, slug) => {
        const { items } = get();
        // Одиночный слот и память — замена; накопители и вентиляторы — ещё одна позиция
        if (!isListSlot(slot) || slot === 'ram') {
          set({
            items: [...items.filter((i) => i.slot !== slot), { slot, slug, qty: 1 }],
            savedId: null,
          });
          return;
        }
        const existing = items.find((i) => i.slot === slot && i.slug === slug);
        set({
          items: existing
            ? items.map((i) =>
                i === existing ? { ...i, qty: Math.min(i.qty + 1, MAX_LIST_QTY) } : i,
              )
            : [...items, { slot, slug, qty: 1 }],
          savedId: null,
        });
      },
      remove: (slot, slug) =>
        set({
          items: get().items.filter(
            (i) => i.slot !== slot || (slug !== undefined && i.slug !== slug),
          ),
          savedId: null,
        }),
      setQty: (slot, slug, qty) => {
        if (qty <= 0) return get().remove(slot, slug);
        set({
          items: get().items.map((i) =>
            i.slot === slot && i.slug === slug ? { ...i, qty: Math.min(qty, MAX_LIST_QTY) } : i,
          ),
          savedId: null,
        });
      },
      setActiveSlot: (activeSlot) => set({ activeSlot }),
      load: (items, savedId) => set({ items, savedId }),
      markSaved: (savedId) => set({ savedId }),
      clear: () => set({ items: [], savedId: null, activeSlot: 'case' }),
    }),
    {
      name: 'redcore-configurator',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
    },
  ),
);
