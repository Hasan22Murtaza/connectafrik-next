import { redirect } from 'next/navigation'

export default function YouthEventsRedirectPage() {
  redirect('/youth-leadership/community?tab=events')
}
