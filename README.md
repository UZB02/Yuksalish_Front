# Yuksalish Front (admin panel)

"O'quvchilar intizomi reytingi" tizimining admin paneli (Vue 3 + TypeScript + Tailwind CSS). Backend: [../Yuksalish_backend](../Yuksalish_backend). Texnik topshiriq: [../docs/TZ.md](../docs/TZ.md).

## Tuzilma

```
admin/    Admin panel: superadmin, maktab administratori va o'qituvchilar uchun (port 5173)
```

Ochiq reyting ilovasi (hamma uchun) bu papkada emas, alohida [Yuksalish-publik](../Yuksalish-publik) loyihasida. Har bir loyiha mustaqil: o'z `package.json`, bog'liqliklari va `.env` fayli bor (umumiy workspace yo'q).

## Ishga tushirish

Avval backend ishlab turishi kerak (`http://localhost:4000`), qarang [Yuksalish_backend/README.md](../Yuksalish_backend/README.md).

```bash
cd admin
npm install
cp .env.example .env.development.local   # kerak bo'lsa (VITE_API_BASE_URL, VITE_PUBLIC_URL)
npm run dev                              # http://localhost:5173
```

Yoki shu papkadan: `npm run install:all`, `npm run dev:admin`.

Dev rejimda `/api` so'rovlari Vite proxy orqali `http://localhost:4000` ga yo'naltiriladi.

## Skriptlar (admin/)

| Komanda             | Vazifasi             |
| ------------------- | -------------------- |
| `npm run dev`       | dev server           |
| `npm run build`     | production build     |
| `npm run typecheck` | `vue-tsc --noEmit`   |
| `npm run lint`      | ESLint               |
| `npm test`          | Vitest               |
| `npm run format`    | Prettier             |

Ochiq reyting ilovasi alohida loyihada: [../Yuksalish-publik](../Yuksalish-publik).
