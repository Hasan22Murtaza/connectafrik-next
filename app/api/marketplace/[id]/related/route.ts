import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import {
  resolveSubcategory,
  stripReservedListingTags,
} from '@/features/marketplace/utils/listingTags'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 24
const CANDIDATE_POOL = 60

type ProductRow = Record<string, unknown> & {
  id: string
  seller_id: string
  category: string
  subcategory?: string | null
  condition?: string | null
  country?: string | null
  location?: string | null
  price?: number | null
  currency?: string | null
  tags?: string[] | null
  is_featured?: boolean | null
  views_count?: number | null
  created_at?: string
}

function enrichProduct(p: ProductRow) {
  const tags = Array.isArray(p.tags) ? p.tags : []
  return {
    ...p,
    subcategory: resolveSubcategory(
      typeof p.subcategory === 'string' ? p.subcategory : null,
      tags
    ),
  }
}

function scoreRelated(source: ProductRow, candidate: ProductRow): number {
  let score = 0

  const sourceSub =
    resolveSubcategory(source.subcategory, source.tags) || null
  const candidateSub =
    resolveSubcategory(candidate.subcategory, candidate.tags) || null

  if (sourceSub && candidateSub && sourceSub === candidateSub) {
    score += 50
  }

  if (source.category && candidate.category === source.category) {
    score += 25
  }

  if (
    source.country &&
    candidate.country &&
    source.country.toLowerCase() === candidate.country.toLowerCase()
  ) {
    score += 12
  }

  if (
    source.location &&
    candidate.location &&
    source.location.toLowerCase() === candidate.location.toLowerCase()
  ) {
    score += 8
  }

  if (source.condition && candidate.condition === source.condition) {
    score += 6
  }

  if (source.currency && candidate.currency === source.currency) {
    score += 4
  }

  const sourcePrice = Number(source.price)
  const candidatePrice = Number(candidate.price)
  if (
    Number.isFinite(sourcePrice) &&
    Number.isFinite(candidatePrice) &&
    sourcePrice > 0
  ) {
    const ratio = candidatePrice / sourcePrice
    if (ratio >= 0.7 && ratio <= 1.3) score += 10
    else if (ratio >= 0.5 && ratio <= 1.5) score += 5
  }

  const sourceTags = new Set(
    stripReservedListingTags(Array.isArray(source.tags) ? source.tags : [])
  )
  const candidateTags = stripReservedListingTags(
    Array.isArray(candidate.tags) ? candidate.tags : []
  )
  for (const tag of candidateTags) {
    if (sourceTags.has(tag)) score += 3
  }

  if (candidate.is_featured) score += 4
  score += Math.min(Number(candidate.views_count) || 0, 100) / 50

  return score
}

function dedupeById(rows: ProductRow[]): ProductRow[] {
  const seen = new Set<string>()
  const out: ProductRow[] = []
  for (const row of rows) {
    if (!row?.id || seen.has(row.id)) continue
    seen.add(row.id)
    out.push(row)
  }
  return out
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const parsedLimit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10)
    const limit = Number.isNaN(parsedLimit)
      ? DEFAULT_LIMIT
      : Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)

    let userId: string | null = null
    let supabase

    try {
      const auth = await getAuthenticatedUser(request)
      userId = auth.user.id
      supabase = auth.supabase
    } catch {
      supabase = createClient(supabaseUrl, supabaseAnonKey)
    }

    const { data: source, error: sourceError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()

    if (sourceError || !source) {
      return errorResponse('Product not found', 404)
    }

    const sourceProduct = source as ProductRow
    const sourceSub = resolveSubcategory(
      sourceProduct.subcategory,
      sourceProduct.tags
    )

    const { count: sellerListingCount } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', sourceProduct.seller_id)
      .eq('is_available', true)

    let candidates: ProductRow[] = []

    // Prefer same subcategory within category.
    if (sourceSub) {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_available', true)
        .eq('category', sourceProduct.category)
        .eq('subcategory', sourceSub)
        .neq('id', id)
        .order('created_at', { ascending: false })
        .limit(CANDIDATE_POOL)

      candidates = candidates.concat((data || []) as ProductRow[])
    }

    // Broader same-category pool.
    if (candidates.length < CANDIDATE_POOL) {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_available', true)
        .eq('category', sourceProduct.category)
        .neq('id', id)
        .order('created_at', { ascending: false })
        .limit(CANDIDATE_POOL)

      candidates = candidates.concat((data || []) as ProductRow[])
    }

    // Same country fallback to fill sparse categories.
    if (candidates.length < limit && sourceProduct.country) {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_available', true)
        .ilike('country', `%${sourceProduct.country}%`)
        .neq('id', id)
        .order('created_at', { ascending: false })
        .limit(CANDIDATE_POOL)

      candidates = candidates.concat((data || []) as ProductRow[])
    }

    // Final fallback: newest available listings.
    if (candidates.length < limit) {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('is_available', true)
        .neq('id', id)
        .order('created_at', { ascending: false })
        .limit(CANDIDATE_POOL)

      candidates = candidates.concat((data || []) as ProductRow[])
    }

    const ranked = dedupeById(candidates)
      .map((product) => ({
        product,
        score: scoreRelated(sourceProduct, product),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        const aTime = new Date(a.product.created_at || 0).getTime()
        const bTime = new Date(b.product.created_at || 0).getTime()
        return bTime - aTime
      })
      .slice(0, limit)
      .map(({ product }) => product)

    const sellerIds = [...new Set(ranked.map((p) => p.seller_id))]
    const { data: sellers } =
      sellerIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .in('id', sellerIds)
        : { data: [] }

    const sellerMap = new Map((sellers || []).map((s) => [s.id, s]))

    let savedIds = new Set<string>()
    if (userId && ranked.length > 0) {
      const productIds = ranked.map((p) => p.id)
      const { data: saves } = await supabase
        .from('product_saves')
        .select('product_id')
        .eq('user_id', userId)
        .in('product_id', productIds)

      savedIds = new Set(saves?.map((s) => s.product_id) || [])
    }

    const result = ranked.map((p) => ({
      ...enrichProduct(p),
      seller: sellerMap.get(p.seller_id) || null,
      is_saved: savedIds.has(p.id),
    }))

    return jsonResponse({
      data: result,
      total: result.length,
      limit,
      seller_listing_count:
        typeof sellerListingCount === 'number' ? sellerListingCount : null,
      source: {
        id: sourceProduct.id,
        category: sourceProduct.category,
        subcategory: sourceSub,
      },
    })
  } catch (err: any) {
    console.error('GET /api/marketplace/[id]/related error:', err)
    return errorResponse(err.message || 'Failed to fetch related products', 500)
  }
}
