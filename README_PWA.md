# PWA Setup Guide for wagr

## Icon Generation

Icons are automatically generated from `public/icon.svg` using Node.js and sharp.

**Generate all icons:**
```bash
npm run generate:icons
```

**Generate Open Graph image:**
```bash
npm run generate:og
```

**Generate all assets (icons + OG image):**
```bash
npm run generate:assets
```

The script will generate all required PWA icon sizes:
- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
- Apple touch icon (180x180)
- Open Graph image (1200x630)

## Open Graph Image

Create an Open Graph image for social media sharing:
- Size: 1200x630px
- Save as: `public/og-image.png`
- Should represent your brand/app

## Environment Variables

Add to your `.env.local`:
```env
NEXT_PUBLIC_APP_URL=https://wagr.app
```

## Testing PWA

1. **Local testing**:
   ```bash
   npm run build
   npm run start
   ```

2. **Chrome DevTools**:
   - Open DevTools > Application > Service Workers
   - Check "Offline" to test offline functionality
   - Application > Manifest to verify manifest

3. **Lighthouse**:
   - Run Lighthouse audit
   - Should score 90+ for PWA

## Production Checklist

- [ ] All icons generated and placed in `public/icons/`
- [ ] `og-image.png` created (1200x630px)
- [ ] `NEXT_PUBLIC_APP_URL` set in environment
- [ ] Service worker registered
- [ ] Manifest.json validated
- [ ] Tested on mobile devices
- [ ] Tested offline functionality
- [ ] Lighthouse PWA audit passed

