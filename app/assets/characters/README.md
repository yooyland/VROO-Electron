# App Character mirror (CSP-safe)

Garage Hero load order:
1. approved + transparent + assetType=character → webp → png → svg
2. placeholder SVG (Heritage only, useInGarageHero)
3. Three.js
4. premium SVG

Never load: Concept, Archive, promotional, unapproved PNG/WebP.

Sync: `npm run sync:characters`
