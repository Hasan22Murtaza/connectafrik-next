/** Shared layout and spacing tokens for consistent marketplace UI. */
export const MP = {
  page: "min-h-screen bg-surface-canvas px-0 sm:px-0 ",
  shell: "flex gap-0 min-w-0 w-full",

  sidebar:
    "w-[280px] shrink-0 py-3 px-4 bg-surface  lg:sticky lg:top-18 lg:self-start lg:max-h-screen lg:overflow-y-auto",
  sidebarFull:
    "w-[280px] shrink-0 py-3 px-4 bg-surface lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto scrollbar-hover",
  shellFull: "flex gap-0 min-w-0 w-full min-h-[calc(100vh-4rem)]",
  sidebarRight:
    "w-[280px] shrink-0 py-4 px-4 lg:sticky lg:top-18 lg:self-start lg:max-h-screen lg:overflow-y-auto",
  sidebarBrowse:
    "sticky md:relative inset-y-0 left-0 z-40 w-[280px] shrink-0 px-4 py-3 bg-surface sm:top-0 top-20 md:h-screen h-[calc(100vh-10rem)] scrollbar-hover overflow-y-auto transform transition-transform duration-300 md:translate-x-0 ",

  main: "flex-1 py-4 px-4 min-w-0 ",
  mainBrowse: "flex-1 px-4 py-4 min-w-0 w-full",

  productGrid:
    "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 sm:gap-1.5",
  productGridCompact:
    "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 sm:gap-1.5",
  sellerGrid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-2",
  statsGrid: "grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2",

  listStack: "space-y-1.5",
  listRow:
    "w-full flex items-center gap-2 p-2 bg-surface rounded-lg border border-border-subtle hover:bg-surface-hover transition-colors text-left shadow-sm",
  listThumb: "w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-surface-secondary shrink-0",

  navList: "space-y-0.5",
  navItem:
    "group w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors duration-150 text-[15px] font-medium cursor-pointer",
  navItemActive: "bg-primary-50 text-primary-700 dark:text-primary-400",
  navItemInactive: "text-content hover:bg-surface-hover",
  navIcon: "w-5 h-5 shrink-0",
  navIconActive: "text-primary-600 dark:text-primary-400",
  navIconInactive: "text-content-secondary",

  sidebarTitleBlock: "mb-3 px-1",
  sidebarTitle: "text-xl font-bold text-content leading-tight",
  sidebarNav: "border-t border-border pt-2",

  section: "mb-4",
  sectionTitle: "text-[17px] font-bold text-content mb-2",
  sectionDivider: "border-t border-border my-4",

  filterHeader: "flex items-center justify-between mb-2 px-1",
  filterTitle: "text-[17px] font-bold text-content",
  filterClear: "text-primary-600 text-sm font-medium hover:underline",
  filterSectionBtn:
    "w-full flex items-center justify-between px-2 py-2 rounded-lg bg-surface-secondary hover:bg-surface-hover text-[15px] font-semibold text-content transition-colors",
  filterOptionsList: "mt-1 mb-2 space-y-0.5",
  filterOption:
    "flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-surface-hover cursor-pointer text-[15px] text-content",
  filterRadio:
    "w-4 h-4 text-primary-600 border-border focus:ring-primary-500 cursor-pointer",

  card: "bg-surface rounded-lg border border-border-subtle shadow-sm",
  cardPadding: "p-2.5",

  sidebarRightStack: "space-y-2 sticky top-4",
  sidebarRightCard: "bg-surface rounded-lg shadow-sm",
  sidebarRightPadding: "p-3",

  searchInput:
    "w-full px-3 py-2 pl-9 bg-surface-input hover:bg-surface-hover focus-visible:bg-surface-hover border-0 rounded-full focus:ring-0 focus:outline-none transition-colors text-sm text-content placeholder:text-content-tertiary",
  selectInput:
    "w-full px-2.5 py-2 bg-surface-input hover:bg-surface-hover border-0 rounded-lg text-sm text-content focus:ring-2 focus:ring-primary-500 focus:outline-none cursor-pointer",

  backLink: "flex items-center gap-1.5 text-content-secondary hover:text-content text-sm",
  pageTitle: "text-xl font-bold text-content",
  pageTitleLg: "text-xl sm:text-2xl font-bold text-content",

  createListingBtn:
    "w-full mt-4 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-primary-50 text-primary-600 font-semibold text-[15px] hover:bg-primary-100 transition-colors dark:bg-primary-50/15",
  createListingBtnTop:
    "w-full mb-3 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-primary-50 text-primary-600 font-semibold text-sm hover:bg-primary-100 transition-colors dark:bg-primary-50/15",
  createListingBtnInline:
    "w-full flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-primary-50 text-primary-600 font-semibold text-sm hover:bg-primary-100 transition-colors dark:bg-primary-50/15",
  sidebarHeader: "flex items-center justify-between mb-4",
  settingsBtn:
    "p-2 rounded-full bg-surface-secondary hover:bg-surface-hover transition-colors text-content-secondary",

  headerRow: "flex items-center justify-between mb-3 flex-wrap gap-2",
  headerActions: "flex items-center gap-1.5 flex-wrap",
} as const;
