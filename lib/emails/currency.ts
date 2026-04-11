export function getCurrencySymbol(currency: string): string {
  const map: Record<string, string> = {
    USD: '$',
    GHS: '₵',
    NGN: '₦',
    KES: 'KSh',
    ZAR: 'R',
  }
  return map[currency] || currency
}
