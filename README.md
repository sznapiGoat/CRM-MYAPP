# CRM Leady

Jednoduchý CRM pro správu leadů — pro freelance webdesignéra, který obvolává místní firmy.

## Stack

- **Next.js 14** (App Router)
- **Convex** (reaktivní databáze + serverové funkce)
- **Tailwind CSS** + TypeScript

---

## Nastavení

### 1. Convex deployment

1. Nainstaluj závislosti: `npm install`.
2. Spusť `npx convex dev` — přihlásí tě, vytvoří deployment, vygeneruje
   `convex/_generated/` a zapíše `CONVEX_DEPLOYMENT` + `NEXT_PUBLIC_CONVEX_URL`
   do `.env.local`. Nech běžet (sleduje změny v `convex/`).

### 2. Proměnné prostředí

`.env.local` doplní `npx convex dev` automaticky. Šablona viz `.env.local.example`:

```
CONVEX_DEPLOYMENT=dev:your-deployment-name
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

### 3. Spuštění

```bash
npm run dev
# → http://localhost:3000
# (v druhém terminálu nech běžet `npx convex dev`)
```

---

## API endpoint pro n8n

`POST /api/leads` — přijme JSON s daty leadu, upsertuje do Convexu podle `google_maps_url` (deduplication). Pokud lead existuje, přeskočí ho.

### Příklad těla požadavku

```json
{
  "nazev": "Autoškola Novák",
  "mesto": "Plzeň",
  "telefon": "+420 777 123 456",
  "adresa": "Náměstí 1, Plzeň",
  "web": null,
  "google_maps_url": "https://maps.google.com/?cid=123",
  "kategorie": "autoškola",
  "duvod": "Bez webu na Google Maps",
  "rating": 4.2
}
```

### V n8n

Použij **HTTP Request** uzel:
- Method: `POST`
- URL: `https://tvoje-domena.vercel.app/api/leads`
- Body: JSON (viz výše)

---

## Nasazení na Vercel

```bash
npx vercel
```

Nebo propoj GitHub repozitář na [vercel.com](https://vercel.com) a přidej environment variables v nastavení projektu.

---

## Stavový diagram

```
novy → zavolano → zajem → demo_poslano → ceka → zavreno → nezajem → (novy)
```

Kliknutí na status pill v tabulce cykluje na další stav. V detailu leadu lze kliknout přímo na cílový stav.

---

## Poznámky

- Žádná autentizace — pro single-user lokální použití.
- Poznámky se ukládají automaticky po opuštění textového pole (onBlur).
- „Označit jako zavoláno" nastaví `last_called_at = now()` a pokud je status `nový`, změní ho na `zavoláno`.
