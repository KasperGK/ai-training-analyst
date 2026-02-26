'use client'

import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    if (!supabase) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_IN') {
        router.push('/')
        router.refresh()
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, router])

  if (!isSupabaseConfigured || !supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted p-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-3">
            <Logo className="h-14 w-14" />
            <h1 className="text-3xl font-bold tracking-tight">Conundrum.</h1>
            <p className="text-sm text-muted-foreground">AI-powered training analyst</p>
          </div>
          <Card className="w-full">
            <CardContent className="space-y-4 pt-6">
              <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
                <strong>Auth not configured.</strong> Add your Supabase credentials to <code>.env.local</code> to enable authentication.
              </div>
              <Button className="w-full" onClick={() => router.push('/')}>
                Continue in Demo Mode
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <Logo className="h-14 w-14" />
          <h1 className="text-3xl font-bold tracking-tight">Conundrum.</h1>
          <p className="text-sm text-muted-foreground">AI-powered training analyst</p>
        </div>
        <Card className="w-full">
          <CardContent className="pt-6">
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: '#0a0a0a',
                      brandAccent: '#262626',
                    },
                  },
                },
              }}
              providers={[]}
              redirectTo={origin ? `${origin}/auth/callback` : undefined}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
