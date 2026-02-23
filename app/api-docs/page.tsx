'use client'

import { useEffect, useRef } from 'react'

export default function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js'
    script.onload = () => {
      // @ts-expect-error SwaggerUIBundle loaded from CDN
      window.SwaggerUIBundle({
        url: '/swagger.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          // @ts-expect-error SwaggerUIBundle loaded from CDN
          window.SwaggerUIBundle.presets.apis,
          // @ts-expect-error SwaggerUIBundle loaded from CDN  
          window.SwaggerUIBundle.SwaggerUIStandalonePreset,
        ],
        layout: 'BaseLayout',
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: 'list',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: false,
      })
    }
    document.body.appendChild(script)

    return () => {
      document.head.removeChild(link)
      document.body.removeChild(script)
    }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #1a5632 0%, #2d8a4e 100%)',
          padding: '24px 40px',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>
            ConnectAfrik API Documentation
          </h1>
          <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: '14px' }}>
            Interactive reference for all platform endpoints
          </p>
        </div>
        <span
          style={{
            background: 'rgba(255,255,255,0.2)',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '13px',
          }}
        >
          v1.0.0
        </span>
      </div>
      <div id="swagger-ui" ref={containerRef} />
    </div>
  )
}
