/** Shared layout tokens for chat UI (theme-aware). */
export const CH = {
  pageShell:
    "mx-auto flex h-[calc(100dvh-6.5rem)] w-full max-w-full overflow-hidden rounded-none border border-border sm:h-[calc(100dvh-7rem)] md:h-[calc(100dvh-4rem)]",
  sidebar:
    "w-full max-w-sm shrink-0 border-r border-border bg-surface-canvas",
  sidebarHeader: "border-b border-border bg-surface px-4 py-4",
  sidebarTitle: "text-xl font-semibold text-content",
  searchInput:
    "w-full rounded-lg border border-border bg-surface-canvas py-2 pl-9 pr-3 text-sm text-content placeholder:text-content-secondary outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100",
  threadRow:
    "group relative flex w-full cursor-pointer items-start gap-3 border-b border-border-subtle px-4 py-3 text-left transition hover:bg-surface",
  threadRowActive: "bg-surface",
  emptyPane: "flex h-full w-full flex-col items-center justify-center bg-surface-canvas px-6",
  dropdown:
    "absolute z-[120] mt-3 w-65 max-w-[90vw] rounded-xl border border-border bg-surface-elevated p-3 shadow-dropdown sm:w-80 sm:p-4",
  dropdownSearch:
    "w-full rounded-lg border border-border bg-surface-canvas py-2 pl-9 pr-3 text-sm text-content placeholder:text-content-secondary outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100",
  windowHeader: "flex items-center justify-between border-b border-border bg-surface-canvas p-2",
  messageArea: "flex flex-col space-y-3 overflow-y-auto overflow-x-hidden bg-surface-canvas px-3 py-2 sm:space-y-4 sm:px-4 sm:py-3",
  composer: "border-t border-border bg-surface-canvas px-2 py-2 sm:px-3 sm:py-3",
  composerInput:
    "min-w-0 flex-1 rounded-full border border-border bg-surface px-3 py-2 text-sm text-content focus:border-primary focus:outline-none",
  sendBtn:
    "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#22c55e] text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:w-9",
} as const
