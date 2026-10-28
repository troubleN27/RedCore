'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeStorage } from './safe-storage';

// Выбор между корзиной и оформлением: промокод, регион доставки, услуги.
// Контактные данные сюда намеренно не пишем — они не должны лежать в браузере.

interface CheckoutState {
  promoCode: string | null;
  zoneCode: string;
  serviceKeys: string[];
  setPromo: (code: string | null) => void;
  setZone: (code: string) => void;
  toggleService: (key: string) => void;
  reset: () => void;
}

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set, get) => ({
      promoCode: null,
      zoneCode: 'pickup',
      serviceKeys: [],
      setPromo: (promoCode) => set({ promoCode }),
      setZone: (zoneCode) => set({ zoneCode }),
      toggleService: (key) => {
        const keys = get().serviceKeys;
        set({ serviceKeys: keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key] });
      },
      reset: () => set({ promoCode: null, serviceKeys: [] }),
    }),
    { name: 'redcore-checkout', version: 1, storage: createJSONStorage(() => safeStorage) },
  ),
);
