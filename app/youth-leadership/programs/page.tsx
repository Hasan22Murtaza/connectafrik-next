import { redirect } from 'next/navigation'

export default function MyYouthProgramsRedirectPage() {
  redirect('/youth-leadership?tab=enrolled')
}
