import { YouthLeadershipShell } from '@/features/youth-leadership/components/YouthLeadershipShell'

export default function YouthLeadershipLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen bg-background">
      <YouthLeadershipShell>{children}</YouthLeadershipShell>
    </div>
  )
}
