import { RiMoonLine, RiSunLine } from "@remixicon/react";
import { useThemeStore } from "../../stores/theme-store";

export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDark = theme === "dark" || (
    theme === "system" &&
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      onClick={toggleTheme}
      className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {isDark
        ? <RiSunLine aria-hidden="true" className="size-5" />
        : <RiMoonLine aria-hidden="true" className="size-5" />}
    </button>
  );
}
