import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  theme: ThemeMode;
  initTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = "theme-mode";

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";

  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
      return savedTheme;
    }
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }

  return "system";
}

function prefersDark(): boolean {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function syncThemeToDocument(theme: ThemeMode): void {
  if (typeof document === "undefined") return;

  document.documentElement.classList.toggle(
    "dark",
    theme === "dark" || (theme === "system" && prefersDark()),
  );
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const theme = getInitialTheme();
  syncThemeToDocument(theme);

  return {
    theme,
    initTheme: () => syncThemeToDocument(get().theme),
    setTheme: (nextTheme) => {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      } catch {
        // Keep the in-memory preference when storage is unavailable.
      }
      syncThemeToDocument(nextTheme);
      set({ theme: nextTheme });
    },
    toggleTheme: () => {
      const isDark = get().theme === "dark" ||
        (get().theme === "system" && prefersDark());
      get().setTheme(isDark ? "light" : "dark");
    },
  };
});

if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (useThemeStore.getState().theme === "system") {
      syncThemeToDocument("system");
    }
  });
}
