import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthenticatedUser } from '@/lib/supabase-server'
import { jsonResponse, errorResponse } from '@/lib/api-utils'
import { getCurrencyForCountry } from '@/features/marketplace/utils/countryCurrency'
import { haversineDistanceKm } from '@/features/marketplace/utils/marketplaceLocation'
import {
  buildListingTags,
  DELIVERY_TAG,
  PICKUP_TAG,
  resolveSubcategory,
  URGENT_TAG,
} from '@/features/marketplace/utils/listingTags'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function enrichProduct(p: Record<string, unknown>) {
  const tags = Array.isArray(p.tags) ? (p.tags as string[]) : []
  return {
    ...p,
    subcategory: resolveSubcategory(
      typeof p.subcategory === 'string' ? p.subcategory : null,
      tags
    ),
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const subcategory = searchParams.get('subcategory')
    const condition = searchParams.get('condition')
    const currency = searchParams.get('currency')
    const country = searchParams.get('country')
    const latParam = searchParams.get('lat')
    const lngParam = searchParams.get('lng')
    const radiusParam = searchParams.get('radius_km')
    const search = searchParams.get('search')
    const minPrice = searchParams.get('min_price')
    const maxPrice = searchParams.get('max_price')
    const postedWithinDays = searchParams.get('posted_within_days')
    const pickupOnly = searchParams.get('pickup_only') === 'true'
    const deliveryAvailable = searchParams.get('delivery_available') === 'true'
    const urgentSale = searchParams.get('urgent') === 'true'
    const featuredOnly = searchParams.get('featured') === 'true'
    const sort = searchParams.get('sort') || 'newest'
    const parsedLimit = parseInt(searchParams.get('limit') || '12', 10)
    const parsedPage = parseInt(searchParams.get('page') || '0', 10)
    const limit = Number.isNaN(parsedLimit) ? 12 : Math.min(Math.max(parsedLimit, 1), 100)
    const page = Number.isNaN(parsedPage) ? 0 : Math.max(parsedPage, 0)
    const from = page * limit
    const to = from + limit - 1
    const seller_id = searchParams.get('seller_id')
    const includeUnavailable = searchParams.get('include_unavailable') === 'true'

    let userId: string | null = null
    let supabase

    try {
      const auth = await getAuthenticatedUser(request)
      userId = auth.user.id
      supabase = auth.supabase
    } catch {
      supabase = createClient(supabaseUrl, supabaseAnonKey)
    }

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })

    if (!(seller_id && includeUnavailable && userId === seller_id)) {
      query = query.eq('is_available', true)
    }

    const filterLat = latParam != null ? Number(latParam) : NaN
    const filterLng = lngParam != null ? Number(lngParam) : NaN
    const filterRadiusKm = radiusParam != null ? Number(radiusParam) : NaN
    const hasGeoFilter =
      Number.isFinite(filterLat) &&
      Number.isFinite(filterLng) &&
      Number.isFinite(filterRadiusKm) &&
      filterRadiusKm > 0

    if (category) query = query.eq('category', category)
    if (subcategory) query = query.eq('subcategory', subcategory)
    if (condition) query = query.eq('condition', condition)
    if (currency) query = query.eq('currency', currency)
    if (country && !hasGeoFilter) query = query.ilike('country', `%${country}%`)
    if (seller_id) query = query.eq('seller_id', seller_id)
    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    if (minPrice != null && minPrice !== '' && Number.isFinite(Number(minPrice))) {
      query = query.gte('price', Number(minPrice))
    }
    if (maxPrice != null && maxPrice !== '' && Number.isFinite(Number(maxPrice))) {
      query = query.lte('price', Number(maxPrice))
    }
    if (featuredOnly) query = query.eq('is_featured', true)
    if (urgentSale) query = query.contains('tags', [URGENT_TAG])
    if (pickupOnly) query = query.contains('tags', [PICKUP_TAG])
    if (deliveryAvailable) query = query.contains('tags', [DELIVERY_TAG])
    if (postedWithinDays) {
      const days = Number(postedWithinDays)
      if (Number.isFinite(days) && days > 0) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
        query = query.gte('created_at', since)
      }
    }

    switch (sort) {
      case 'price_asc':
        query = query.order('price', { ascending: true })
        break
      case 'price_desc':
        query = query.order('price', { ascending: false })
        break
      case 'oldest':
        query = query.order('created_at', { ascending: true })
        break
      case 'popular':
        query = query.order('views_count', { ascending: false }).order('created_at', { ascending: false })
        break
      case 'featured':
        query = query.order('is_featured', { ascending: false }).order('created_at', { ascending: false })
        break
      case 'nearest':
        // Distance sort applied after fetch when geo filter coords exist.
        query = query.order('created_at', { ascending: false })
        break
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false })
        break
    }
    query = query.range(from, to)

    const { data: products, error, count } = await query

    if (error) throw error

    let productList = products || []
    const total = typeof count === 'number' ? count : productList.length

    if (hasGeoFilter) {
      productList = productList
        .map((product) => {
          const plat = product.latitude
          const plng = product.longitude
          let distanceKm: number | null = null
          if (plat != null && plng != null && Number.isFinite(plat) && Number.isFinite(plng)) {
            distanceKm = haversineDistanceKm(filterLat, filterLng, plat, plng)
          }
          return { product, distanceKm }
        })
        .filter(({ product, distanceKm }) => {
          if (distanceKm != null) return distanceKm <= filterRadiusKm
          if (country && product.country) {
            return product.country.toLowerCase().includes(country.toLowerCase())
          }
          return false
        })
        .sort((a, b) => {
          if (sort === 'nearest') {
            return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
          }
          return 0
        })
        .map(({ product }) => product)
    }

    const sellerIds = [...new Set(productList.map(p => p.seller_id))]
    const { data: sellers } = sellerIds.length > 0
      ? await supabase.from('profiles').select('id, username, full_name, avatar_url').in('id', sellerIds)
      : { data: [] }

    const sellerMap = new Map((sellers || []).map(s => [s.id, s]))

    let savedIds = new Set<string>()
    if (userId && productList.length > 0) {
      const productIds = productList.map(p => p.id)
      const { data: saves } = await supabase
        .from('product_saves')
        .select('product_id')
        .eq('user_id', userId)
        .in('product_id', productIds)

      savedIds = new Set(saves?.map(s => s.product_id) || [])
    }

    const result = productList.map(p => ({
      ...enrichProduct(p),
      seller: sellerMap.get(p.seller_id) || null,
      is_saved: savedIds.has(p.id),
    }))

    // Geo filter is applied after the DB query, so fall back to page-local totals.
    const effectiveTotal = hasGeoFilter
      ? page * limit + result.length + (result.length === limit ? limit : 0)
      : total

    return jsonResponse({
      data: result,
      page,
      pageSize: limit,
      total: effectiveTotal,
      pageCount: Math.max(1, Math.ceil(effectiveTotal / limit)),
      hasMore: hasGeoFilter
        ? result.length === limit
        : (page + 1) * limit < total,
    })
  } catch (err: any) {
    console.error('GET /api/marketplace error:', err)
    return errorResponse(err.message || 'Failed to fetch products', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request)
    const body = await request.json()

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('country, city')
      .eq('id', user.id)
      .single()

    if (profileError) throw profileError

    if (!profile?.country?.trim()) {
      return errorResponse(
        'Add your country in profile settings before creating a listing',
        400
      )
    }

    const { code: currency } = getCurrencyForCountry(profile.country)
    const listingCountry = profile.country.trim()
    const listingLocation =
      (typeof body.location === 'string' && body.location.trim()) ||
      profile.city?.trim() ||
      null

    const latitude =
      typeof body.latitude === 'number' && Number.isFinite(body.latitude)
        ? body.latitude
        : null
    const longitude =
      typeof body.longitude === 'number' && Number.isFinite(body.longitude)
        ? body.longitude
        : null

    const userTags = Array.isArray(body.tags) ? body.tags.map(String) : []
    const tags = buildListingTags({
      urgentSale: Boolean(body.urgent_sale),
      pickupOnly: Boolean(body.pickup_only),
      deliveryAvailable: Boolean(body.delivery_available),
      contactEmail: Boolean(body.contact_email),
      contactPhone: Boolean(body.contact_phone_pref),
      contactChat: body.contact_chat !== false,
      userTags,
    })

    const shippingAvailable =
      typeof body.shipping_available === 'boolean'
        ? body.shipping_available
        : Boolean(body.delivery_available)

    const subcategoryValue =
      typeof body.subcategory === 'string' && body.subcategory.trim()
        ? body.subcategory.trim()
        : null

    const insertPayload: Record<string, unknown> = {
      seller_id: user.id,
      title: body.title,
      description: body.description,
      price: body.price,
      currency,
      category: body.category,
      subcategory: subcategoryValue,
      condition: body.condition,
      location: listingLocation,
      country: listingCountry,
      latitude,
      longitude,
      images: body.images || [],
      tags,
      stock_quantity: body.stock_quantity ?? 1,
      is_available: true,
      is_featured: Boolean(body.is_featured),
    }

    if (typeof body.contact_phone === 'string' && body.contact_phone.trim()) {
      insertPayload.contact_phone = body.contact_phone.trim()
    }
    if (typeof shippingAvailable === 'boolean') {
      insertPayload.shipping_available = shippingAvailable
    }

    const { data, error } = await supabase
      .from('products')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      // Retry without optional columns if schema does not include them yet.
      const msg = error.message || ''
      if (
        msg.includes('shipping_available') ||
        msg.includes('contact_phone') ||
        msg.includes('is_featured') ||
        msg.includes('subcategory')
      ) {
        if (msg.includes('shipping_available')) delete insertPayload.shipping_available
        if (msg.includes('contact_phone')) delete insertPayload.contact_phone
        if (msg.includes('is_featured')) insertPayload.is_featured = false
        if (msg.includes('subcategory')) delete insertPayload.subcategory
        const retry = await supabase.from('products').insert(insertPayload).select().single()
        if (retry.error) throw retry.error
        return jsonResponse({ data: enrichProduct(retry.data) }, 201)
      }
      throw error
    }

    return jsonResponse({ data: enrichProduct(data) }, 201)
  } catch (err: any) {
    if (err.message === 'Unauthorized' || err.message === 'Missing Authorization header') {
      return errorResponse('Unauthorized', 401)
    }
    console.error('POST /api/marketplace error:', err)
    return errorResponse(err.message || 'Failed to create product', 500)
  }
}
