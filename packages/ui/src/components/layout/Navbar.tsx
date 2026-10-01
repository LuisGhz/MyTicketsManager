import { useEffect, useId, useRef, useState } from "react";
import { RiCloseLine, RiMenuLine } from "@remixicon/react";
import { useAuthStore } from "../../stores/auth-store";
import type { Role } from "../../types";
import { ThemeToggle } from "./ThemeToggle";

export interface NavbarItem {
  href: string;
  label: string;
  roles?: readonly Role[];
}

export interface NavbarProps {
  brandName?: string;
  brandHref?: string;
  links?: readonly NavbarItem[];
  className?: string;
}

const defaultLinks: readonly NavbarItem[] = [
  { href: "/tickets/new", label: "New ticket", roles: ["USER", "AGENT", "ADMIN"] },
  { href: "/tickets/my", label: "My tickets", roles: ["USER"] },
  { href: "/agent", label: "Agent dashboard", roles: ["AGENT"] },
  { href: "/admin", label: "Admin dashboard", roles: ["ADMIN"] },
];

const linkClassName =
  "inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function Navbar({
  brandName = "Ticket Desk",
  brandHref = "/",
  links = defaultLinks,
  className = "",
}: NavbarProps) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const visibleLinks = links.filter(
    (link) => !link.roles || (user !== null && link.roles.includes(user.role)),
  );

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.getElementById(menuId)?.querySelector<HTMLElement>("a, button")?.focus();
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen, menuId]);

  const closeMenu = () => setIsMenuOpen(false);
  const handleLogout = () => {
    logout();
    closeMenu();
  };
  const renderLinks = (prefix: string) => visibleLinks.map((link) => (
    <a
      key={`${prefix}-${link.href}`}
      href={link.href}
      onClick={closeMenu}
      className={linkClassName}
    >
      {link.label}
    </a>
  ));

  return (
    <header className={`border-b border-border bg-background text-foreground ${className}`}>
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <a
          href={brandHref}
          className="shrink-0 rounded-sm text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {brandName}
        </a>

        <nav aria-label="Primary navigation" className="hidden flex-1 items-center gap-1 md:flex">
          {renderLinks("desktop")}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user && (
            <span className="hidden max-w-48 truncate text-sm text-muted-foreground lg:block">
              {user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user.email}
            </span>
          )}
          {user
            ? <button type="button" onClick={handleLogout} className={`${linkClassName} hidden md:inline-flex`}>Sign out</button>
            : <a href="/login" className={`${linkClassName} hidden md:inline-flex`}>Sign in</a>}
          <ThemeToggle />
          <button
            ref={menuButtonRef}
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:hidden"
            aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMenuOpen}
            aria-controls={menuId}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen
              ? <RiCloseLine aria-hidden="true" className="size-5" />
              : <RiMenuLine aria-hidden="true" className="size-5" />}
          </button>
        </div>
      </div>

      <div id={menuId} className={`${isMenuOpen ? "block" : "hidden"} border-t border-border px-4 py-3 md:hidden`}>
        <nav aria-label="Mobile navigation" className="flex flex-col items-stretch gap-1">
          {renderLinks("mobile")}
          {user
            ? <button type="button" onClick={handleLogout} className={`${linkClassName} justify-start`}>Sign out</button>
            : <a href="/login" onClick={closeMenu} className={linkClassName}>Sign in</a>}
        </nav>
      </div>
    </header>
  );
}
