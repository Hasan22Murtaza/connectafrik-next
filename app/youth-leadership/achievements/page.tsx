import { redirect } from 'next/navigation'

export default function YouthAchievementsRedirectPage() {
  redirect('/youth-leadership/progress?tab=achievements')
}
