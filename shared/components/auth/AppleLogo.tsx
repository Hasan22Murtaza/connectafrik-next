import React from 'react'

/** Official-style Apple logo mark for Sign in with Apple buttons. */
export function AppleLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M16.365 1.43c0 1.14-.42 2.2-1.14 3.03-.75.87-1.98 1.54-3.18 1.45-.14-1.1.43-2.25 1.14-3.05.76-.87 2.05-1.52 3.18-1.43zM20.9 17.2c-.55 1.26-.82 1.82-1.53 2.93-.99 1.54-2.39 3.46-4.13 3.48-1.55.02-1.95-1.01-4.06-1-2.1.01-2.55 1.02-4.1 1.04-1.73.02-3.05-1.75-4.05-3.28C1.3 17.55-.4 12.7 1.7 9.36c1.05-1.67 2.72-2.72 4.61-2.75 1.81-.04 3.52 1.22 4.06 1.22.53 0 2.53-1.51 4.27-1.29.73.03 2.78.29 4.1 2.2-3.5 1.92-2.94 6.93.16 8.46z"
      />
    </svg>
  )
}
