'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { articles, categories, type WikiArticle } from '@/lib/wiki/articles'
import {
  ArrowLeft,
  Search,
  BookOpen,
  Clock,
  ChevronRight,
  LayoutGrid,
  List,
} from 'lucide-react'

type ViewMode = 'cards' | 'list'

const categoryColors: Record<string, string> = {
  fundamentals: 'bg-blue-100 text-blue-800',
  metrics: 'bg-green-100 text-green-800',
  concepts: 'bg-purple-100 text-purple-800',
  'app-guide': 'bg-orange-100 text-orange-800',
}

function ArticleCard({ article }: { article: WikiArticle }) {
  return (
    <Link href={`/learn/${article.slug}`}>
      <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <Badge variant="secondary" className={categoryColors[article.category]}>
              {categories[article.category].label}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {article.readingTime} min
            </div>
          </div>
          <CardTitle className="text-lg mt-2">{article.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="line-clamp-2">
            {article.excerpt}
          </CardDescription>
          <div className="flex items-center gap-1 mt-3 text-sm text-primary">
            Read more <ChevronRight className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function ArticleListItem({ article }: { article: WikiArticle }) {
  return (
    <Link href={`/learn/${article.slug}`}>
      <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer border-b last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">
              {categories[article.category].label}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {article.readingTime} min
            </span>
          </div>
          <h3 className="font-medium text-sm">{article.title}</h3>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </div>
    </Link>
  )
}

export default function LearnPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  const filteredArticles = useMemo(() => {
    let result = articles

    if (selectedCategory) {
      result = result.filter(a => a.category === selectedCategory)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(a =>
        a.title.toLowerCase().includes(query) ||
        a.excerpt.toLowerCase().includes(query)
      )
    }

    return result
  }, [searchQuery, selectedCategory])

  const articlesByCategory = useMemo(() => {
    const grouped: Record<string, WikiArticle[]> = {}
    for (const article of filteredArticles) {
      if (!grouped[article.category]) {
        grouped[article.category] = []
      }
      grouped[article.category].push(article)
    }
    return grouped
  }, [filteredArticles])

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="border-b bg-background px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to Dashboard</span>
            </Button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Training Knowledge
              </h1>
              <p className="text-sm text-muted-foreground">
                Learn about training metrics and concepts
              </p>
            </div>
          </div>
          {/* Search in header */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Category Filters + View Toggle */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                All
              </Button>
              {Object.entries(categories).map(([key, cat]) => (
                <Button
                  key={key}
                  variant={selectedCategory === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(key)}
                >
                  {cat.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('cards')}
                title="Card view"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode('list')}
                title="List view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Results Count */}
          <p className="text-sm text-muted-foreground">
            {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''} found
          </p>

          {/* Articles */}
          {searchQuery || selectedCategory ? (
            // Show flat list/grid when filtering
            viewMode === 'cards' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredArticles.map((article) => (
                  <ArticleCard key={article.slug} article={article} />
                ))}
              </div>
            ) : (
              <Card className="overflow-hidden">
                {filteredArticles.map((article) => (
                  <ArticleListItem key={article.slug} article={article} />
                ))}
              </Card>
            )
          ) : (
            // Show grouped by category when not filtering
            <div className="space-y-8">
              {Object.entries(categories).map(([key, cat]) => {
                const categoryArticles = articlesByCategory[key]
                if (!categoryArticles?.length) return null

                return (
                  <section key={key}>
                    <div className="flex items-center gap-2 mb-4">
                      <h2 className="text-lg font-semibold">{cat.label}</h2>
                      <span className="text-sm text-muted-foreground">
                        {cat.description}
                      </span>
                    </div>
                    {viewMode === 'cards' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categoryArticles.map((article) => (
                          <ArticleCard key={article.slug} article={article} />
                        ))}
                      </div>
                    ) : (
                      <Card className="overflow-hidden">
                        {categoryArticles.map((article) => (
                          <ArticleListItem key={article.slug} article={article} />
                        ))}
                      </Card>
                    )}
                  </section>
                )
              })}
            </div>
          )}

          {/* Empty State */}
          {filteredArticles.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No articles found</p>
                <p className="text-sm text-muted-foreground">
                  Try a different search term or category
                </p>
              </CardContent>
            </Card>
          )}

          {/* Sources Note */}
          <Card className="bg-muted/50">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">
                All articles include verified sources from TrainingPeaks, TrainerRoad, CTS, and peer-reviewed research.
                We strive to provide accurate, science-backed information.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
