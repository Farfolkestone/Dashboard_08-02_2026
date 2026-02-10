import { create } from 'zustand'

type ThemeMode = 'light' | 'dark'

interface ThemeState {
  theme: ThemeMode
  initialized: boolean
  initTheme: () => void
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

const STORAGE_KEY = 'yieldpro-theme'

const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(theme)
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  initialized: false,

  initTheme: () => {
    if (get().initialized) return

    const stored = localStorage.getItem(STORAGE_KEY)
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const nextTheme: ThemeMode =
      stored === 'dark' || stored === 'light'
        ? (stored as ThemeMode)
        : (systemPrefersDark ? 'dark' : 'light')

    applyTheme(nextTheme)
    set({ theme: nextTheme, initialized: true })
  },

  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme)
    applyTheme(theme)
    set({ theme, initialized: true })
  },

  toggleTheme: () => {
    const next: ThemeMode = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(STORAGE_KEY, next)
    applyTheme(next)
    set({ theme: next, initialized: true })
  },
}))

