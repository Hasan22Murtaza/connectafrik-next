/** Reserved tag prefixes for TradeHub listing metadata (stored in products.tags).
 *  Subcategory is stored on products.subcategory — not in tags.
 */

export const URGENT_TAG = "urgent:true";
export const PICKUP_TAG = "fulfillment:pickup";
export const DELIVERY_TAG = "fulfillment:delivery";
export const DRAFT_TAG = "draft:true";
export const CONTACT_EMAIL_TAG = "contact:email";
export const CONTACT_PHONE_TAG = "contact:phone";
export const CONTACT_CHAT_TAG = "contact:chat";

/** @deprecated Subcategory now uses products.subcategory column */
export const SUBCATEGORY_TAG_PREFIX = "subcat:";

export function subcategoryTag(value: string): string {
  return `${SUBCATEGORY_TAG_PREFIX}${value}`;
}

/** Fallback for older listings that stored subcategory in tags. */
export function parseSubcategoryFromTags(tags: string[] | null | undefined): string | null {
  if (!tags?.length) return null;
  const found = tags.find((t) => t.startsWith(SUBCATEGORY_TAG_PREFIX));
  return found ? found.slice(SUBCATEGORY_TAG_PREFIX.length) : null;
}

export function resolveSubcategory(
  subcategory: string | null | undefined,
  tags?: string[] | null
): string | null {
  if (typeof subcategory === "string" && subcategory.trim()) {
    return subcategory.trim();
  }
  return parseSubcategoryFromTags(tags);
}

export function hasTag(tags: string[] | null | undefined, tag: string): boolean {
  return Boolean(tags?.includes(tag));
}

export function stripReservedListingTags(tags: string[]): string[] {
  return tags.filter(
    (t) =>
      !t.startsWith(SUBCATEGORY_TAG_PREFIX) &&
      t !== URGENT_TAG &&
      t !== PICKUP_TAG &&
      t !== DELIVERY_TAG &&
      t !== DRAFT_TAG &&
      t !== CONTACT_EMAIL_TAG &&
      t !== CONTACT_PHONE_TAG &&
      t !== CONTACT_CHAT_TAG
  );
}

export type ListingMetaTagsInput = {
  urgentSale?: boolean;
  pickupOnly?: boolean;
  deliveryAvailable?: boolean;
  contactEmail?: boolean;
  contactPhone?: boolean;
  contactChat?: boolean;
  userTags?: string[];
};

/** Build tags for create/update (fulfillment / contact / urgent only — not subcategory). */
export function buildListingTags(input: ListingMetaTagsInput): string[] {
  const tags = stripReservedListingTags(
    (input.userTags || []).map((t) => t.trim()).filter(Boolean)
  );

  if (input.urgentSale) tags.push(URGENT_TAG);
  if (input.pickupOnly) tags.push(PICKUP_TAG);
  if (input.deliveryAvailable) tags.push(DELIVERY_TAG);
  if (input.contactEmail) tags.push(CONTACT_EMAIL_TAG);
  if (input.contactPhone) tags.push(CONTACT_PHONE_TAG);
  if (input.contactChat) tags.push(CONTACT_CHAT_TAG);

  return [...new Set(tags)];
}
