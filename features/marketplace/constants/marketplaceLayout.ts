/** Shared layout and spacing tokens for consistent marketplace UI. */
export const MP = {
  page: "min-h-screen bg-[#F0F2F5] px-0 sm:px-0",
  shell: "flex gap-0 min-w-0 w-full max-w-screen-2xl mx-auto",

  sidebar:
    "w-[245px] shrink-0 py-3 px-2 bg-white border-r border-gray-200 lg:sticky lg:top-0 lg:self-start lg:max-h-screen lg:overflow-y-auto",
  sidebarFull:
    "w-[245px] shrink-0 py-3 px-2 bg-white  lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto scrollbar-hover",
  shellFull: "flex gap-0 min-w-0 w-full max-w-screen-2xl mx-auto min-h-[calc(100vh-4rem)]",
  sidebarRight:
    "w-[260px] shrink-0 py-3 px-2  lg:sticky lg:top-0 lg:self-start lg:max-h-screen lg:overflow-y-auto",
  sidebarBrowse:
    "fixed md:relative inset-y-0 left-0 z-40 w-[245px] shrink-0 px-2 py-3 bg-white sm:top-0 top-12 md:h-screen h-[calc(100vh-6rem)] scrollbar-hover overflow-y-auto transform transition-transform duration-300 md:translate-x-0 md:border-r md:border-gray-200",

  main: "flex-1 py-4 px-4 min-w-0",
  mainBrowse: "flex-1 px-4 py-4 min-w-0 w-full",

  productGrid:
    "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 sm:gap-1.5",
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
    "group w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors duration-150 text-[15px] font-medium cursor-pointer",
  navItemActive: "bg-primary-50 text-gray-900",
  navItemInactive: "text-gray-900 hover:bg-gray-100",
  navIcon: "w-5 h-5 shrink-0",
  navIconActive: "text-primary-600",
  navIconInactive: "text-gray-900",

  sidebarTitleBlock: "mb-3 px-1",
  sidebarTitle: "text-xl font-bold text-gray-900 leading-tight",
  sidebarNav: "border-t border-gray-200 pt-2",

  section: "mb-4",
  sectionTitle: "text-[17px] font-bold text-gray-900 mb-2",
  sectionDivider: "border-t border-gray-200 my-4",

  filterHeader: "flex items-center justify-between mb-2 px-1",
  filterTitle: "text-[17px] font-bold text-gray-900",
  filterClear: "text-primary-600 text-sm font-medium hover:underline",
  filterSectionBtn:
    "w-full flex items-center justify-between px-2 py-2 rounded-lg bg-[#F0F2F5] hover:bg-[#E4E6E9] text-[15px] font-semibold text-gray-900 transition-colors",
  filterOptionsList: "mt-1 mb-2 space-y-0.5",
  filterOption:
    "flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50 cursor-pointer text-[15px] text-gray-900",
  filterRadio:
    "w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500 cursor-pointer",

  card: "bg-white rounded-lg border border-gray-100 shadow-sm",
  cardPadding: "p-2.5",

  sidebarRightStack: "space-y-2 sticky top-4",
  sidebarRightCard: "bg-white rounded-lg shadow-sm",
  sidebarRightPadding: "p-3",

  searchInput:
    "w-full px-3 py-2 pl-9 bg-[#EEF1F4] hover:bg-[#DDE2E6] focus-visible:bg-[#DDE2E6] border-0 rounded-full focus:ring-0 focus:outline-none transition-colors text-sm",
  selectInput:
    "w-full px-2.5 py-2 bg-[#EEF1F4] hover:bg-[#DDE2E6] border-0 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none cursor-pointer",

  backLink: "flex items-center gap-1.5 text-gray-600 hover:text-gray-900 text-sm",
  pageTitle: "text-xl font-bold text-gray-900",
  pageTitleLg: "text-xl sm:text-2xl font-bold text-gray-900",

  createListingBtn:
    "w-full mt-4 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-primary-50 text-primary-600 font-semibold text-[15px] hover:bg-primary-100 transition-colors",
  createListingBtnTop:
    "w-full mb-3 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-primary-50 text-primary-600 font-semibold text-sm hover:bg-primary-100 transition-colors",
  createListingBtnInline:
    "w-full flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-primary-50 text-primary-600 font-semibold text-sm hover:bg-primary-100 transition-colors",
  sidebarHeader: "flex items-center justify-between mb-4",
  settingsBtn:
    "p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700",

  headerRow: "flex items-center justify-between mb-3 flex-wrap gap-2",
  headerActions: "flex items-center gap-1.5 flex-wrap",
} as const;
