/** A branded, validated slug. */
export type Slug = string & { readonly __brand: "Slug" };

export function toSlug(input: string): Slug {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") as Slug;
}

export const VERSION: string = "1.0.0";
