# CRM Leady

Jednoduchý CRM pro správu leadů — pro freelance webdesignéra, který obvolává místní firmy.

## Stack

- **Next.js 14** (App Router)
- **Supabase** (PostgreSQL + REST)
- **Tailwind CSS** + TypeScript

---

## Nastavení

### 1. Supabase projekt

1. Přejdi na [supabase.com](https://supabase.com) a vytvoř nový projekt.
2. V SQL editoru spusť celý obsah souboru `supabase/schema.sql`.
3. V nastavení projektu (`Settings → API`) si zkopíruj:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Proměnné prostředí

Zkopíruj `.env.local.example` jako `.env.local` a doplň hodnoty:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3. Instalace a spuštění

```bash
npm install
npm run dev
# → http://localhost:3000
```

---

## API endpoint pro n8n

`POST /api/leads` — přijme JSON s daty leadu, upsertuje do Supabase podle `google_maps_url` (deduplication). Pokud lead existuje, přeskočí ho.

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
