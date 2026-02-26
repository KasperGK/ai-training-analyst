'use client'

import { usePathname } from 'next/navigation'
import { MainCarousel } from '@/components/layout/main-carousel'

const CAROUSEL_PATHS = new Set(['/', '/coach', '/training', '/athlete', '/learn'])

export default function CarouselLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  if (CAROUSEL_PATHS.has(pathname)) {
    return <MainCarousel className="flex-1 min-h-0" />
  }

  return <>{children}</>
}
