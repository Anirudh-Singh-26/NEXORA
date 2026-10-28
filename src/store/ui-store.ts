import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type UiTheme = 'dark' | 'light'

type UiState = {
  theme: UiTheme
  setTheme: (theme: UiTheme) => void
  toggleTheme: () => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (value: boolean) => void
  searchOpen: boolean
  setSearchOpen: (value: boolean) => void
  /** Environment selection: testnet (default) or mainnet */
  env: 'testnet' | 'mainnet'
  setEnv: (env: 'testnet' | 'mainnet') => void
  toggleEnv: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      sidebarCollapsed: false,
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
      searchOpen: false,
      setSearchOpen: (value) => set({ searchOpen: value }),
      /** default to testnet for fresh sessions */
      env: 'testnet',
      setEnv: (env) => set({ env }),
      toggleEnv: () => set({ env: get().env === 'testnet' ? 'mainnet' : 'testnet' }),
    }),
    {
      name: 'nexora-ui',
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed, theme: state.theme, env: state.env }),
    },
  ),
)
