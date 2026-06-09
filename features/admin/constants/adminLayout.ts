/** Premium admin panel design tokens — SaaS-style layout system. */
export const AP = {
  page: "min-h-screen bg-gradient-to-br from-slate-50 via-[#F8FAFC] to-orange-50/40",
  shell: "flex gap-0 min-w-0 w-full max-w-screen-2xl mx-auto min-h-[calc(100vh-4rem)]",
  main: "flex-1 py-5 px-4 sm:px-6 min-w-0 w-full",

  card:
    "bg-white/90 backdrop-blur-sm rounded-xl border border-gray-100/90 shadow-sm shadow-gray-200/40",
  cardPadding: "p-4 sm:p-5",
  cardHover:
    "hover:shadow-lg hover:shadow-gray-200/50 hover:-translate-y-0.5 transition-all duration-300 ease-out",
  cardInteractive: "cursor-pointer group",

  statsGrid: "grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4",

  sidebar:
    "w-[260px] shrink-0 py-4 px-3 bg-white/95 backdrop-blur-md border-r border-gray-100 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto scrollbar-hover",
  sidebarMobile:
    "fixed inset-y-0 left-0 z-50 w-[280px] py-4 px-3 bg-white/98 backdrop-blur-lg border-r border-gray-100 shadow-2xl transform transition-transform duration-300 ease-out lg:hidden",
  sidebarOverlay:
    "fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden transition-opacity duration-300",

  navList: "space-y-1",
  navItem:
    "group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-[15px] font-medium cursor-pointer",
  navItemActive:
    "bg-gradient-to-r from-primary-50 to-orange-50 text-gray-900 shadow-sm shadow-primary-100/50",
  navItemInactive: "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
  navIcon: "w-5 h-5 shrink-0 transition-colors duration-200",
  navIconActive: "text-primary-600",
  navIconInactive: "text-gray-500 group-hover:text-gray-700",

  header:
    "sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/80 shadow-sm shadow-gray-200/30",
  headerInner: "flex h-14 sm:h-16 items-center gap-3 px-4 sm:px-6 max-w-screen-2xl mx-auto",

  searchInput:
    "w-full pl-10 pr-4 py-2 bg-gray-100/80 hover:bg-gray-100 focus:bg-white border border-transparent focus:border-primary-200 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-all duration-200 text-sm placeholder:text-gray-400",

  tableWrap: "overflow-x-auto -mx-px",
  table: "w-full text-sm",
  tableHead: "border-b border-gray-100 bg-gray-50/80 text-left text-gray-500 text-xs uppercase tracking-wide",
  tableHeadCell: "px-4 py-3 font-medium whitespace-nowrap",
  tableRow: "border-b border-gray-50 hover:bg-gray-50/80 transition-colors duration-150",
  tableCell: "px-4 py-3",

  btnPrimary:
    "inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 active:scale-[0.98] transition-all duration-200 shadow-sm shadow-primary-600/20 disabled:opacity-50 disabled:pointer-events-none",
  btnSecondary:
    "inline-flex items-center justify-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 active:scale-[0.98] transition-all duration-200 disabled:opacity-50",

  sectionDivider: "border-t border-gray-100 my-4",
} as const;
