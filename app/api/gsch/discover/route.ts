import { NextRequest } from 'next/server'
import { GET as citiesGet } from '@/app/api/gsch/cities/route'

/** Discover is an alias around the cities list with the same filters. */
export async function GET(request: NextRequest) {
  return citiesGet(request)
}
