import { getNoIndexMetadata } from '@/lib/seo'
import CallsPageView from '@/features/chat/components/CallsPageView'

export const metadata = getNoIndexMetadata('Calls')

export default function CallsPage() {
  return <CallsPageView />
}
