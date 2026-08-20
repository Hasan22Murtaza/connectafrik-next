export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { startMarketplaceCron } = await import('./lib/marketplace/marketplaceCron')
  startMarketplaceCron()
}
