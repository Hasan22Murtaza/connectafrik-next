import { createServiceClient } from '@/lib/supabase-server'
import { processEscrowReleases } from '@/lib/marketplace/escrowService'
import { escalateOverdueDisputes } from '@/lib/marketplace/disputeService'

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000
const STARTUP_DELAY_MS = 20_000

let started = false
let running = false

async function runMarketplaceJobs(source: string) {
  if (running) {
    console.warn(`[marketplace-cron] skipped overlapping run (${source})`)
    return
  }

  running = true
  const serviceClient = createServiceClient()

  try {
    const escrow = await processEscrowReleases(serviceClient)
    console.log('[marketplace-cron] escrow', source, escrow)
  } catch (error) {
    console.error('[marketplace-cron] escrow failed', source, error)
  }

  try {
    const disputes = await escalateOverdueDisputes(serviceClient)
    console.log('[marketplace-cron] disputes', source, disputes)
  } catch (error) {
    console.error('[marketplace-cron] disputes failed', source, error)
  } finally {
    running = false
  }
}

/**
 * In-process scheduler for Digital Ocean (`next start` on a droplet).
 * Disable with MARKETPLACE_IN_PROCESS_CRON=false if you use OS crontab instead.
 */
export function startMarketplaceCron() {
  if (started) return
  if (process.env.MARKETPLACE_IN_PROCESS_CRON === 'false') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  started = true

  const intervalMs = Number(process.env.MARKETPLACE_CRON_INTERVAL_MS) || DEFAULT_INTERVAL_MS

  setTimeout(() => {
    void runMarketplaceJobs('startup')
  }, STARTUP_DELAY_MS)

  setInterval(() => {
    void runMarketplaceJobs('interval')
  }, intervalMs)

  console.log(
    `[marketplace-cron] started; interval=${intervalMs}ms (Digital Ocean in-process)`
  )
}
