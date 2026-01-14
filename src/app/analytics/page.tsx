import { redirect } from 'next/navigation'

export default function AnalyticsPage() {
  redirect('/athlete?tab=history')
}
