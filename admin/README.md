# Admin panel

Superadmin, maktab administratori va o'qituvchilar uchun Vue 3 ilova. Umumiy ma'lumot: [../README.md](../README.md).

## Tuzilma (src/)

```
api/          axios instans, interceptorlar (token yangilash), API modullari, tiplar
components/   ui/ (asosiy komponentlar), layout/, domain/, scoring/, settings/ ...
composables/  qayta ishlatiladigan mantiq (useScoringSheet, useImportWizard, ...)
constants/    rollar, ruxsatlar, navigatsiya
layouts/      AuthLayout, DashboardLayout
locales/      uz.json (vue-i18n)
router/       marshrutlar va guard lar (rol / ruxsat bo'yicha)
stores/       Pinia (auth, school-context, ui)
validation/   Zod sxemalar
views/        sahifalar
```

## Muhim qarorlar

- Access token faqat xotirada (Pinia); refresh token httpOnly cookie da, backend bilan `withCredentials`.
- Menyu va guard bitta `canAccess` mantig'idan foydalanadi (rol + ruxsat).
- Barcha matnlar `locales/uz.json` da (i18n).
