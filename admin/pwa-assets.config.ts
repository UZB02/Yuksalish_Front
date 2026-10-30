import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Ikonkalar `npm run pwa:icons` bilan public/ ga generatsiya qilinadi va repoga commit qilinadi
// (Docker build paytida qayta yaratilmaydi). Manba: public/pwa-source.svg - to'liq to'ldirilgan
// kvadrat, belgi markaziy xavfsiz zonada (maskable ikonka kesilib qolmaydi).
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
    apple: { ...minimal2023Preset.apple, padding: 0 },
  },
  images: ['public/pwa-source.svg'],
})
