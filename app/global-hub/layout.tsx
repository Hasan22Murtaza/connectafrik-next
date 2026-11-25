import { GschShell } from '@/features/gsch/components/GschShell'

export default function GlobalHubLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen bg-background">
      <GschShell>{children}</GschShell>
    </div>
  )
}
