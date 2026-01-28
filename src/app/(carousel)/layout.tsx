'use client'

import { MainCarousel } from '@/components/layout/main-carousel'

export default function CarouselLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Children are not used - MainCarousel handles both pages internally
  // This layout just keeps MainCarousel mounted across / and /coach routes
  return <MainCarousel className="flex-1 min-h-0" />
}
