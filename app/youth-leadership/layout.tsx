export default function YouthLeadershipLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen bg-background">
      <div className="relative">{children}</div>
    </div>
  )
}
