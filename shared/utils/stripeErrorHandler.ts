/**
 * Stripe Error Handler
 * Suppresses non-critical Stripe iframe communication errors
 */

let isHandlerInstalled = false

export const installStripeErrorHandler = () => {
  if (isHandlerInstalled) return
  
  // Store original error handler
  const originalError = console.error
  const originalWarn = console.warn
  
  // Override console.error to filter Stripe iframe errors
  console.error = (...args) => {
    const message = args[0]?.toString() || ''
    
    // Check if this is a Stripe iframe communication error
    if (message.includes('message port closed') || 
        message.includes('stripe.network') ||
        message.includes('js.stripe.com') ||
        message.includes('Unchecked runtime.lastError')) {
      // Suppress these non-critical Stripe errors
      return
    }
    
    // Pass through all other errors
    originalError.apply(console, args)
  }
  
  // Override console.warn for Stripe warnings
  console.warn = (...args) => {
    const message = args[0]?.toString() || ''
    
    // Check if this is a Stripe-related warning
    if (message.includes('stripe') || message.includes('Stripe')) {
      // You can choose to suppress or keep these
      // For now, let's keep them but make them less noisy
      return
    }
    
    // Pass through all other warnings
    originalWarn.apply(console, args)
  }
  
  // Handle unhandled promise rejections from Stripe
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.toString() || ''
    
    if (reason.includes('stripe') || 
        reason.includes('message port closed') ||
        reason.includes('runtime.lastError')) {
      // Suppress Stripe-related unhandled rejections
      event.preventDefault()
      return
    }
  })
  
  isHandlerInstalled = true
}

export const removeStripeErrorHandler = () => {
  // This would restore original handlers if needed
  // For now, we'll keep the handler active
  isHandlerInstalled = false
}
