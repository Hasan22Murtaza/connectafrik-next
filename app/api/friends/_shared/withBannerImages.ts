import type { SupabaseClient } from '@supabase/supabase-js'

type IdRow = { id?: string; user_id?: string }

/** Attach `profiles.banner_image` onto rows that come from RPCs without that column. */
export async function withBannerImages<T extends IdRow>(
  supabase: SupabaseClient,
  rows: T[]
): Promise<Array<T & { banner_image: string | null }>> {
  const ids = [
    ...new Set(
      rows
        .map((row) => row.id || row.user_id)
        .filter((id): id is string => typeof id === 'string')
    ),
  ]
  const bannerById = new Map<string, string | null>()

  if (ids.length > 0) {
    const { data } = await supabase.from('profiles').select('id, banner_image').in('id', ids)
    for (const row of data || []) {
      bannerById.set(row.id as string, (row.banner_image as string | null) ?? null)
    }
  }

  return rows.map((row) => {
    const id = row.id || row.user_id
    return {
      ...row,
      banner_image: id ? bannerById.get(id) ?? null : null,
    }
  })
}
