// Deterministic fictional names. These are not real partner or affiliate merchants.
const prefixes = ['Alder', 'Juniper', 'Canyon', 'Cedar', 'Willow', 'Mesa', 'Harbor', 'Birch', 'Aspen', 'Summit', 'Pebble', 'Meadow', 'Copper', 'Maple', 'Sierra', 'Brook', 'Orchard', 'Dune', 'Valley', 'Laurel', 'Pine'] as const;
const formats = ['Road Footwear', 'Trail Outfitters', 'Walking Studio', 'Running Room', 'Sneaker Supply', 'Footwear Outlet', 'Sport Market'] as const;
export const merchantNames: [string, ...string[]] = ['Stride Supply', 'Trail & Field', 'Everyday Athletics', ...prefixes.flatMap(prefix => formats.map(format => `${prefix} ${format}`))];
export type Merchant = string;
export function merchantInitials(name: Merchant): string {
  return name.split(/\s+/).filter(word => word !== '&').slice(0, 2).map(word => word[0]).join('');
}
