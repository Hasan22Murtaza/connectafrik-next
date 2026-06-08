/** Shared layout and spacing tokens for consistent marketplace UI. */
export const MP = {
  page: "min-h-screen px-3 sm:px-4",
  shell: "flex gap-3 min-w-0 w-full max-w-screen-2xl mx-auto",

  sidebar: "w-[260px] shrink-0 py-4",
  sidebarBrowse:
    "fixed md:relative inset-y-0 left-0 z-40 w-[260px] shrink-0 px-3 py-4 sm:top-0 top-12 md:h-screen h-[calc(100vh-6rem)] scrollbar-hover overflow-y-auto transform transition-transform duration-300 md:translate-x-0",

  main: "flex-1 py-4 min-w-0",
  mainBrowse: "flex-1 px-0.5 sm:px-2 py-4 min-w-0 w-full",

  productGrid:
    "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-1 sm:gap-1.5",
  productGridCompact:
    "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 sm:gap-1.5",
  sellerGrid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-2",
  statsGrid: "grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2",

  listStack: "space-y-1.5",
  listRow:
    "w-full flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors text-left shadow-sm",
  listThumb: "w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0",

  navList: "space-y-0.5",
  navItem:
    "group relative w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all duration-200 text-sm font-medium cursor-pointer",
  navItemActive: "bg-orange-50 text-primary-600",
  navItemInactive: "text-gray-500 hover:bg-gray-100 hover:text-primary-600",
  navIcon: "w-4 h-4 shrink-0 transition-transform group-hover:scale-105",
  navIconActive: "scale-105",
  navIndicator:
    "absolute left-0 top-0 h-full w-[3px] rounded-r transition-all duration-200 bg-primary-600",

  section: "mb-4",
  sectionTitle:
    "text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 px-2",

  card: "bg-white rounded-lg border border-gray-100 shadow-sm",
  cardPadding: "p-2.5",

  searchInput:
    "w-full px-3 py-2 pl-9 bg-[#EEF1F4] hover:bg-[#DDE2E6] focus-visible:bg-[#DDE2E6] border-0 rounded-full focus:ring-0 focus:outline-none transition-colors text-sm",
  selectInput:
    "w-full px-2.5 py-2 bg-[#EEF1F4] hover:bg-[#DDE2E6] border-0 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none cursor-pointer",

  backLink: "flex items-center gap-1.5 text-gray-600 hover:text-gray-900 text-sm px-2",
  pageTitle: "text-xl font-bold text-gray-900",
  pageTitleLg: "text-xl sm:text-2xl font-bold text-gray-900",

  createListingBtn:
    "w-full mt-4 flex items-center justify-center gap-1.5 py-2 px-3 rounded-full bg-primary-50 text-primary-600 font-semibold text-sm hover:bg-primary-100 transition-colors",

  headerRow: "flex items-center justify-between mb-3 flex-wrap gap-2",
  headerActions: "flex items-center gap-1.5 flex-wrap",
} as const;
