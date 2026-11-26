const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

type GoogleNamespace = {
  maps: typeof google.maps
}

type GoogleMapsWindow = Window & {
  google?: GoogleNamespace
  __gschGoogleMapsPromise?: Promise<typeof google.maps | null>
}

/** Load the Maps JavaScript API once (shared with social Places usage). */
export function loadGoogleMaps(
  libraries = 'places'
): Promise<typeof google.maps | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)

  const win = window as GoogleMapsWindow
  if (win.google?.maps) return Promise.resolve(win.google.maps)

  if (win.__gschGoogleMapsPromise) return win.__gschGoogleMapsPromise

  win.__gschGoogleMapsPromise = new Promise((resolve) => {
    if (!GOOGLE_MAPS_API_KEY) {
      resolve(null)
      return
    }

    const existing = document.querySelector(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    ) as HTMLScriptElement | null

    const finish = () => {
      const maps = (window as GoogleMapsWindow).google?.maps || null
      resolve(maps)
    }

    if (existing) {
      if ((window as GoogleMapsWindow).google?.maps) {
        finish()
        return
      }
      existing.addEventListener('load', finish, { once: true })
      const poll = window.setInterval(() => {
        if ((window as GoogleMapsWindow).google?.maps) {
          window.clearInterval(poll)
          finish()
        }
      }, 100)
      window.setTimeout(() => {
        window.clearInterval(poll)
        finish()
      }, 15000)
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=${libraries}`
    script.async = true
    script.defer = true
    script.onload = finish
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })

  return win.__gschGoogleMapsPromise
}

export function hasGoogleMapsApiKey() {
  return Boolean(GOOGLE_MAPS_API_KEY)
}
