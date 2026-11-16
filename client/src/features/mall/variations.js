import { kes } from '../../utils/format.js';

/** The variation matching a choice like { Storage: '256GB', Colour: 'Blue' }, or null. */
export function findSku(product, chosen) {
  if (!product?.skus?.length) return null;
  return product.skus.find((s) => product.variants.every((v) => s.options[v.label] === chosen?.[v.label])) ?? null;
}

/** True when the variations have different prices ("From KES 50,000"). */
export const variesInPrice = (product) => new Set((product?.skus ?? []).map((s) => s.price)).size > 1;

/** "KES 50,000" or "From KES 50,000". */
export const priceLabel = (product) => (variesInPrice(product) ? `From ${kes(product.price)}` : kes(product.price));

/** Is this option value still possible given the other choices (some stocked variation has it)? */
export function optionAvailable(product, chosen, label, value) {
  if (!product?.skus?.length) return true;
  return product.skus.some(
    (s) => s.stock > 0 && s.options[label] === value && product.variants.every((v) => v.label === label || !chosen?.[v.label] || s.options[v.label] === chosen[v.label]),
  );
}

/** "Storage: 256GB · Colour: Blue" */
export const skuLabel = (product, sku) => product.variants.map((v) => `${v.label}: ${sku.options[v.label]}`).join(' · ');
