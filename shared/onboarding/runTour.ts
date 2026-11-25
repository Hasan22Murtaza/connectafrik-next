'use client'

import { driver, type DriveStep, type Driver } from 'driver.js'
import type { OnboardingStep } from './types'

export type TourFinishReason = 'completed' | 'skipped' | 'closed'

type RunTourOptions = {
  steps: OnboardingStep[]
  onFinish: (reason: TourFinishReason) => void
}

let activeDriver: Driver | null = null

export function destroyActiveTour() {
  if (activeDriver) {
    try {
      activeDriver.destroy()
    } catch {
      /* already destroyed */
    }
    activeDriver = null
  }
}

function isElementVisible(el: Element): boolean {
  const html = el as HTMLElement
  if (!html.getClientRects().length) return false
  let node: HTMLElement | null = html
  while (node) {
    const style = window.getComputedStyle(node)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false
    }
    node = node.parentElement
  }
  return true
}

/** Prefer the first visibly rendered match (handles desktop sidebar vs mobile nav duplicates). */
function queryVisible(selector: string): Element | null {
  const nodes = document.querySelectorAll(selector)
  for (const node of nodes) {
    if (isElementVisible(node)) return node
  }
  return null
}

function waitForElement(selector: string, timeoutMs = 2500): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = queryVisible(selector)
    if (existing) {
      resolve(existing)
      return
    }

    const started = Date.now()
    const observer = new MutationObserver(() => {
      const el = queryVisible(selector)
      if (el) {
        observer.disconnect()
        resolve(el)
      } else if (Date.now() - started > timeoutMs) {
        observer.disconnect()
        resolve(queryVisible(selector))
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
    window.setTimeout(() => {
      observer.disconnect()
      resolve(queryVisible(selector))
    }, timeoutMs)
  })
}

async function resolveVisibleSteps(steps: OnboardingStep[]): Promise<DriveStep[]> {
  const resolved: DriveStep[] = []

  for (const step of steps) {
    if (!step.element) {
      resolved.push({
        popover: {
          title: step.title,
          description: step.description,
          align: step.align ?? 'center',
        },
      })
      continue
    }

    const el = await waitForElement(step.element)
    if (!el) continue

    resolved.push({
      element: el,
      popover: {
        title: step.title,
        description: step.description,
        side: step.side ?? 'right',
        align: step.align ?? 'start',
      },
    })
  }

  return resolved
}

/** Returns true when a blocking dialog/modal is open — do not interrupt. */
export function hasBlockingWorkflow(): boolean {
  if (typeof document === 'undefined') return false
  if (document.querySelector('[role="dialog"][data-state="open"]')) return true
  if (document.querySelector('[role="dialog"]:not([aria-hidden="true"])')) {
    const dialogs = document.querySelectorAll('[role="dialog"]')
    for (const d of dialogs) {
      const style = window.getComputedStyle(d)
      if (style.display !== 'none' && style.visibility !== 'hidden') return true
    }
  }
  if (document.querySelector('[data-onboarding-block="true"]')) return true
  return false
}

export async function runGuidedTour(options: RunTourOptions): Promise<void> {
  destroyActiveTour()

  const driveSteps = await resolveVisibleSteps(options.steps)
  if (driveSteps.length === 0) {
    options.onFinish('skipped')
    return
  }

  let finished = false
  const finish = (reason: TourFinishReason) => {
    if (finished) return
    finished = true
    activeDriver = null
    options.onFinish(reason)
  }

  const instance = driver({
    showProgress: true,
    animate: true,
    overlayOpacity: 0.55,
    stagePadding: 8,
    stageRadius: 10,
    allowClose: true,
    smoothScroll: true,
    overlayClickBehavior: 'close',
    popoverClass: 'ca-onboarding-popover',
    nextBtnText: 'Next',
    prevBtnText: 'Previous',
    doneBtnText: 'Finish',
    progressText: '{{current}} / {{total}}',
    steps: driveSteps,
    onPopoverRender: (popover) => {
      // Hostinger-style Close + Skip alongside built-in nav
      const footer = popover.footerButtons
      if (!footer || footer.querySelector('.ca-onboarding-skip')) return

      const skip = document.createElement('button')
      skip.type = 'button'
      skip.className = 'ca-onboarding-skip'
      skip.textContent = 'Skip tour'
      skip.addEventListener('click', () => {
        finish('skipped')
        instance.destroy()
      })

      // Insert Skip before Next when possible
      const next = footer.querySelector('.driver-popover-next-btn')
      if (next?.parentElement) {
        next.parentElement.insertBefore(skip, next)
      } else {
        footer.appendChild(skip)
      }

      // Relabel first-step Next → Explore for Hostinger feel
      if (instance.getActiveIndex() === 0 && next) {
        next.textContent = driveSteps.length === 1 ? 'Explore' : 'Explore'
      }
    },
    onDestroyStarted: (_el, _step, opts) => {
      // Allow driver to proceed with destroy; classify in onDestroyed
      if (opts.reason && opts.reason !== 'done') {
        finish('skipped')
      }
      instance.destroy()
    },
    onDestroyed: (_el, _step, opts) => {
      if (finished) return
      finish(opts.reason === 'done' ? 'completed' : 'skipped')
    },
  })

  activeDriver = instance
  instance.drive()
}
