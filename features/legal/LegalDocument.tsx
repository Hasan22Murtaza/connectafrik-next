'use client'

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Search, Shield } from '@/shared/icons'

type LegalDocumentProps = {
  title: string
  effective?: string
  updated?: string
  children: React.ReactNode
}

type TocItem = {
  id: string
  title: string
}

const cardClass =
  'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6 lg:p-8'

const proseClass =
  'space-y-4 text-[15px] leading-7 text-slate-700 dark:text-slate-300 [&_a]:font-medium [&_a]:text-orange-500 [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mb-5 [&_h2]:mt-0 [&_h2]:scroll-mt-24 [&_h2]:border-b [&_h2]:border-slate-200 [&_h2]:pb-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-slate-900 dark:[&_h2]:border-slate-800 dark:[&_h2]:text-slate-100 sm:[&_h2]:text-xl lg:[&_h2]:text-2xl [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-900 dark:[&_h3]:text-slate-100 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_strong]:font-semibold [&_strong]:text-slate-900 dark:[&_strong]:text-slate-100 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5'

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return slug || 'section'
}

function renderBlocks(children: React.ReactNode) {
  const blocks: React.ReactNode[] = []
  let loose: React.ReactNode[] = []

  const flush = () => {
    if (loose.length === 0) return
    blocks.push(
      <div key={`loose-${blocks.length}`} className={`${cardClass} ${proseClass}`}>
        {loose}
      </div>
    )
    loose = []
  }

  Children.forEach(children, (child) => {
    if (isValidElement<{ className?: string; id?: string }>(child) && child.type === 'section') {
      flush()
      const className = [cardClass, proseClass, 'scroll-mt-24', child.props.className]
        .filter(Boolean)
        .join(' ')
      blocks.push(cloneElement(child, { className }))
      return
    }
    loose.push(child)
  })

  flush()
  return blocks
}

export function LegalDocument({ title, effective, updated, children }: LegalDocumentProps) {
  const articleRef = useRef<HTMLElement>(null)
  const [toc, setToc] = useState<TocItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const blocks = useMemo(() => renderBlocks(children), [children])

  useEffect(() => {
    const sections = articleRef.current?.querySelectorAll('section') ?? []
    const used = new Set<string>()
    const items: TocItem[] = []

    sections.forEach((section, index) => {
      const heading = section.querySelector('h2')
      const label = heading?.textContent?.trim() || `Section ${index + 1}`
      let id = section.id || slugify(label)
      if (used.has(id)) id = `${id}-${index + 1}`
      used.add(id)
      section.id = id
      items.push({ id, title: label })
    })

    setToc(items)
  }, [blocks])

  const filteredSections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return toc
    return toc.filter((section) => section.title.toLowerCase().includes(query))
  }, [searchQuery, toc])

  return (
    <main className="min-h-screen bg-slate-50/70 py-8 dark:bg-slate-950 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Shield className="h-3.5 w-3.5" />
                Policies
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
                {title}
              </h1>
            </div>
            {updated || effective ? (
              <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:w-auto">
                <p className="font-medium text-slate-800 dark:text-slate-200">Last updated</p>
                <p>{updated || effective}</p>
              </div>
            ) : null}
          </div>
        </header>

        <div className={`grid gap-6 lg:gap-8 ${toc.length > 0 ? 'lg:grid-cols-[280px_minmax(0,1fr)]' : ''}`}>
          {toc.length > 0 ? (
            <aside className="lg:sticky lg:top-24 lg:h-fit">
              <nav
                className="w-full space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-5 lg:max-h-[78vh] lg:overflow-y-auto"
                aria-label="Table of contents"
              >
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  On this page
                </h2>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search sections..."
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none ring-emerald-500/30 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-emerald-400"
                    aria-label="Search policy sections"
                  />
                </div>
                <ul className="space-y-1.5">
                  {filteredSections.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="block rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                      >
                        {section.title}
                      </a>
                    </li>
                  ))}
                  {filteredSections.length === 0 ? (
                    <li className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      No section matches your search.
                    </li>
                  ) : null}
                </ul>
              </nav>
            </aside>
          ) : null}

          <article ref={articleRef} className="min-w-0 space-y-6">
            {blocks}
          </article>
        </div>
      </div>
    </main>
  )
}
