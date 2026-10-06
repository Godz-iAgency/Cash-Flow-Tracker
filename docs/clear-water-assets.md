# Clear-water card photography

Generated with the built-in image generation tool on 2026-10-06. The supplied JPEG and AVIF served as visual references for new photographs; they were not altered or shipped as application assets. The existing logo is unchanged.

Final project assets:

- `public/water/clear-surface.webp`: Home and Expenses; 1536 × 1024, 241,432 bytes.
- `public/water/clear-flow.webp`: Income and Cash flow; 1536 × 1024, 157,568 bytes.

The generated PNGs were encoded as WebP at quality 82 for delivery. The two static assets total about 390 KiB; the second loads only when its first card is needed. No animation, video, blur filter, image JavaScript, or per-frame work is involved.

Photo text lives on a 96% pale backplate. Ink, soft text and links pass normal-text contrast even against the darkest and brightest possible image pixels. Increased contrast or reduced transparency makes the backplate opaque.

## Final prompts

### Clear surface

Use case: photorealistic-natural. Asset type: wide background photograph for Cash Flow Tracker cards. Input image 1 is a reference for clear shallow water and sun caustics; image 2 is a reference for clean turquoise underwater light. Generate a NEW coherent photograph, not an edit and not a UI mockup. Primary request: beautifully clear crystal water flowing gently over pale fine sand, viewed close from above. Authentic soft sun caustics, broad fluid ripples, serene natural aquamarine and warm ivory, restrained saturation. Wide landscape 3:2 composition, quieter darker teal water toward the left, luminous clear water and sand texture toward the right; crops must work for a wide home card and small cards. Natural editorial photography, refined calm texture, no horizon. No text, lettering, logos, coins, money, people, boats, buildings, plants, rocks, collage or frame. No artificial glowing shapes. This is a static lightweight wallpaper; UI text will be placed separately.

### Clear flow

Use case: photorealistic-natural. Asset type: second coordinated wallpaper for Cash Flow Tracker income and cash-flow cards. Input image 1 is a reference for crystal shallow water; image 2 is a reference for immersive clear underwater light. Generate a NEW photograph, not an edit and not a UI. A close view just under the surface of pristine clear water, gentle liquid folds and sunlight refracting into soft moving-looking bands, pale sandy bed barely visible. Wide landscape 3:2 photograph. Quiet darker teal area at left, luminous aqua water to the right, no horizon, natural and calm with broad rounded ripples rather than dense sparkling noise. Editorial photographic detail, restrained aquamarine and warm ivory consistent with shallow clear water. No text, logos, money, people, objects, collage or frame. Static card wallpaper, leave the composition uncluttered; actual interface text is separate.
