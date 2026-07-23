# Serving Contract

User intent and provider serving metadata have different ownership.

- Requested quantity and unit describe what the user asked for.
- Provider serving quantity, unit, gram weight, and nutrition describe one atomic provider record.
- A scale factor is computed once when units are compatible.
- Final totals are recomputed from final items.

Mass, volume, and count are not interchangeable. One cup has no universal gram weight, one piece has no universal mass, and a package weight is not a count. Product-specific provider weights may bridge these units. Unsupported conversions remain reviewable instead of being invented.

Restaurant foods use natural units such as burger, sandwich, bowl, taco, or footlong when supported. Internal math keeps precision and presentation performs final rounding.
