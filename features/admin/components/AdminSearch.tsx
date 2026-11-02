"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "@/shared/icons";
import { ADMIN_SEARCHABLE_LINKS } from "../constants/adminNavigation";
import { AP } from "../constants/adminLayout";

export function AdminSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = query.trim()
    ? ADMIN_SEARCHABLE_LINKS.filter((link) =>
        link.label.toLowerCase().includes(query.toLowerCase())
      )
    : ADMIN_SEARCHABLE_LINKS;

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
    <div className="relative mx-auto hidden max-w-md flex-1 sm:block" ref={containerRef}>
      <label htmlFor="admin-search" className="sr-only">
        Search admin pages
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
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
        placeholder="Search admin…"
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
          className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
          role="listbox"
        >
          {results.map((link, i) => {
            const Icon = link.icon;
            return (
              <li key={`${link.href}-${link.label}`} role="option" aria-selected={i === activeIndex}>
                <button
                  id={`admin-search-result-${i}`}
                  type="button"
                  onClick={() => navigate(link.href)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                    i === activeIndex
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
                  <span className="flex-1 font-medium">{link.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
