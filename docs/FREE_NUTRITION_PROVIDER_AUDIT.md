# Free Nutrition Provider Audit

Reviewed July 13, 2026. This is an engineering assessment, not legal advice.

| Provider | Role | Authentication | Practical limit | Storage/licensing posture | Decision |
| --- | --- | --- | --- | --- | --- |
| USDA FoodData Central | Generic foods, branded search, exact branded barcode | Server-side API key | Default 1,000 requests/hour/IP | USDA data is public domain/CC0 | Keep authoritative for generic foods; add guarded branded-serving and barcode support |
| Open Food Facts | Packaged-food barcode and narrowly gated branded search | No key; descriptive `User-Agent` required | Product reads 15/min/IP; search 10/min/IP | Database ODbL, contents DbCL, images CC BY-SA | Integrate as a community source with short normalized caches, attribution, conservative confidence, and no images |
| UPC Database | Barcode identity metadata only | Server-side Bearer key | Free plan currently 100 product lookups and 25 searches/day | Community data; accuracy and durable reuse rights are not guaranteed | Optional rescue step only; never nutrition provenance and never saveable by itself |
| Spoonacular | Broad recipe/food API | API key | Free plan currently 50 points/day and 1 request/second | Terms restrict storage and derived storage; caching requires permission and is limited; backlink required | Do not integrate into saved-meal production flow |

## Open Food Facts

MacroMesh uses the current v3 product-read endpoint for exact barcode lookup. Open Food Facts has not released a current full-text search endpoint, so branded text search is isolated behind the official legacy endpoint and is called only for explicit non-restaurant packaged-product queries. Search-as-you-type is prohibited.

Community records must pass schema, identity, serving, and nutrition plausibility validation. Exact barcode identity does not automatically make incomplete nutrition high confidence. Images are intentionally excluded because they add separate attribution and redistribution obligations.

Official references:

- [Open Food Facts API](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/)
- [Product v3 endpoint](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/)
- [Licensing guidance](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/)

## UPC Database

UPC Database is not a nutrition source. When every direct barcode nutrition provider misses, MacroMesh may use one UPC Database product lookup to recover title, brand, category, and package text. It then performs at most one normal nutrition search. The resulting item keeps the actual nutrition provider as provenance and must strongly agree with the recovered identity. Non-food categories, estimates, ambiguity, and untrusted results are rejected.

Official references:

- [API documentation](https://upcdatabase.org/api)
- [Authentication](https://upcdatabase.org/api-auth)
- [Limits](https://upcdatabase.org/api-limits)
- [Terms](https://upcdatabase.org/terms)

## USDA

Branded USDA search records report nutrients per 100 g while also carrying a natural household serving and serving weight. MacroMesh first converts per-100g nutrition into one provider serving, then applies requested quantity exactly once. A 55 g bar is one bar, not 55 bars. Leading-zero GTIN/UPC values remain strings.

Official references:

- [FoodData Central API guide](https://fdc.nal.usda.gov/api-guide/)
- [API specification](https://fdc.nal.usda.gov/api-spec/fdc_api.html)
- [Data documentation](https://fdc.nal.usda.gov/data-documentation/)

## Review Trigger

Re-review provider terms, limits, endpoints, and attribution before changing cache duration, persisting provider-derived records, showing provider images, exporting a provider-derived database, or adding a paid/commercial plan.
