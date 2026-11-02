/** CribsTalk admin design tokens — ChatGPT-simple layout with brand accent. */
export const AP = {
  page: "min-h-screen bg-[#faf8f6] text-gray-900",
  shell: "flex min-h-screen w-full min-w-0 overflow-x-hidden",
  main: "flex-1 min-w-0 px-4 py-6 sm:px-6 lg:px-8",

  card: "bg-white rounded-lg border border-gray-200",
  cardPadding: "p-4 sm:p-5",
  cardHover: "hover:border-primary-200 transition-colors duration-150",
  cardInteractive: "cursor-pointer group",

  statsGrid: "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4",

  sidebar:
    "hidden lg:flex flex-col shrink-0 border-r border-[#e4e6eb] bg-white transition-[width] duration-200 ease-out z-20",
  sidebarExpanded: "w-56 min-w-56",
  sidebarCollapsed: "w-14 min-w-14",
  sidebarMobile:
    "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-white border-r border-[#e4e6eb] shadow-xl transform transition-transform duration-200 ease-out lg:hidden",
  sidebarOverlay: "fixed inset-0 z-40 bg-black/40 lg:hidden",

  navList: "space-y-0.5",
  navItem:
    "group w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors duration-150 cursor-pointer",
  navItemActive: "bg-[#f0f2f5] text-[#050505]",
  navItemInactive: "text-[#65676b] hover:bg-[#f2f2f2] hover:text-[#050505]",
  navItemDisabled: "text-gray-400 cursor-not-allowed opacity-70",
  navIcon: "w-[22px] h-[22px] shrink-0",
  navIconActive: "text-[#050505]",
  navIconInactive: "text-[#65676b] group-hover:text-[#050505]",

  header: "sticky top-0 z-30 border-b border-gray-200 bg-white",
  headerInner: "flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8",

  searchInput:
    "w-full rounded-md border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-500/30",

  tableWrap: "overflow-x-auto -mx-px",
  table: "w-full text-sm",
  tableHead:
    "border-b border-gray-200 bg-[#fafafa] text-left text-xs font-medium uppercase tracking-wide text-gray-500",
  tableHeadCell: "px-4 py-3 whitespace-nowrap",
  tableRow:
    "border-b border-gray-100 hover:bg-primary-50/40 transition-colors duration-100",
  tableCell: "px-4 py-3",

  btnPrimary:
    "inline-flex items-center justify-center gap-2 rounded-md bg-primary-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:pointer-events-none disabled:opacity-50 transition-colors",
  btnSecondary:
    "inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50 transition-colors",
  btnGhost:
    "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-primary-50 hover:text-primary-700 transition-colors",

  sectionDivider: "border-t border-gray-200 my-3",
  brandAccent: "text-primary-600",
  brandAccentGreen: "text-[var(--african-green)]",
  link: "text-sm font-medium text-primary-600 hover:text-primary-700 underline-offset-2 hover:underline",
} as const;
