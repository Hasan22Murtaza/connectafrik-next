/** Parsed from Google Places `address_components` (Place Details). */
export type ParsedGoogleAddress = {
  address: string
  city: string
  state: string
  zipcode: string
  country: string
}

export function parseGoogleAddressComponents(
  components: { long_name: string; short_name: string; types: string[] }[] | undefined
): ParsedGoogleAddress {
  let streetNumber = ''
  let route = ''
  let subpremise = ''
  let country = ''
  let city = ''
  let state = ''
  let zipcode = ''

  if (!components?.length) {
    return { address: '', city, state, zipcode, country }
  }

  for (const c of components) {
    const t = c.types
    if (t.includes('street_number')) streetNumber = c.long_name
    if (t.includes('route')) route = c.long_name
    if (t.includes('subpremise')) subpremise = c.long_name
    if (t.includes('country')) country = c.long_name
    if (t.includes('postal_code')) zipcode = c.long_name
    if (t.includes('administrative_area_level_1')) state = c.long_name
    if (t.includes('locality')) city = c.long_name
    else if (t.includes('postal_town') && !city) city = c.long_name
    else if (t.includes('administrative_area_level_2') && !city) city = c.long_name
    else if (t.includes('sublocality_level_1') && !city) city = c.long_name
    else if (t.includes('neighborhood') && !city) city = c.long_name
  }

  const line1 = [streetNumber, route].filter(Boolean).join(' ').trim()
  const address =
    subpremise && line1 ? `${subpremise}, ${line1}` : subpremise || line1 || ''

  return { address, city, state, zipcode, country }
}
