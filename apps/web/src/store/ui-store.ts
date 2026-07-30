'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setActiveOrgId } from '@/lib/api-client';
import { MOCK_ORG_ID } from '@/lib/mock/data';

interface UiState {
  /** Active tenant id — sent as x-org-id on every request. */
  orgId: string;
  setOrgId: (id: string) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebar: (v: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      orgId: MOCK_ORG_ID,
      setOrgId: (id) => {
        setActiveOrgId(id);
        set({ orgId: id });
      },
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebar: (v) => set({ sidebarCollapsed: v }),
    }),
    {
      name: 'marketforge-ui',
      // Keep only durable prefs; org syncs to api-client on rehydrate below.
      partialize: (s) => ({
        orgId: s.orgId,
        sidebarCollapsed: s.sidebarCollapsed,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.orgId) setActiveOrgId(state.orgId);
      },
    },
  ),
);

/** Selector: current active org id. */
export const useOrgId = () => useUiStore((s) => s.orgId);
