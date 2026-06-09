"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { ADMIN_NAV_LINKS } from "../constants/adminNavigation";
import { AP } from "../constants/adminLayout";

export function AdminSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = query.trim()
    ? ADMIN_NAV_LINKS.filter((link) =>
        link.label.toLowerCase().includes(query.toLowerCase())
      )
    : ADMIN_NAV_LINKS;

  const navigate = useCallback(
    (href: string) => {
      setQuery("");
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      navigate(results[activeIndex].href);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative flex-1 max-w-md hidden sm:block" ref={containerRef}>
      <label htmlFor="admin-search" className="sr-only">
        Search admin pages
      </label>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
        aria-hidden="true"
      />
      <input
        id="admin-search"
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search admin pages..."
        className={AP.searchInput}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="admin-search-results"
        aria-activedescendant={
          open && results[activeIndex]
            ? `admin-search-result-${activeIndex}`
            : undefined
        }
      />

      {open && results.length > 0 && (
        <ul
          id="admin-search-results"
          className="absolute left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl rounded-xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden z-50"
          role="listbox"
        >
          {results.map((link, i) => {
            const Icon = link.icon;
            return (
              <li key={link.href} role="option" aria-selected={i === activeIndex}>
                <button
                  id={`admin-search-result-${i}`}
                  type="button"
                  onClick={() => navigate(link.href)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                    i === activeIndex ? "bg-primary-50 text-primary-700" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 font-medium">{link.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-40" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
