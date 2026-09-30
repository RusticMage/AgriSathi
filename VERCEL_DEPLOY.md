# Deploy AgriSathi to Vercel

## Vercel project settings

- Root directory: this `agro-advisory` folder
- Framework preset: Other
- Build command: leave empty
- Output directory: leave empty
- Install command: `npm install`
- Node.js runtime: 22.x

The `public/` directory serves the desktop frontend. Requests under `/api/*` use the catch-all Node.js Function in `api/[...path].js`. `npm start` still runs the same handler locally through `start.js`.

## Required production environment variables

Set these in the Vercel project's **Settings → Environment Variables** for Production (and Preview if you will use preview URLs):

- `GEMINI_API_KEY`: Google AI Studio key. Keep it server-side.
- `DATABASE_URL`: Supabase PostgreSQL connection string. Prefer the Supabase session pooler URL for Vercel's IPv4 serverless runtime, copied from Supabase **Connect**. Never use a frontend `NEXT_PUBLIC_` name.
- `PG_POOL_MAX`: `1` to keep each serverless instance's connection pool small.
- `NODE_ENV`: `production` so session cookies use `Secure`.

Redeploy after adding or changing environment variables. The local `.env` is excluded from deployment; no secret value belongs in this file or in Git.

## Deploy from PowerShell

From this folder, install and sign into the Vercel CLI, then link the folder to a new or existing Vercel project:

```powershell
npm install --global vercel
vercel login
vercel link
```

Add `GEMINI_API_KEY` and `DATABASE_URL` through the Vercel dashboard so their values are not saved in terminal history. Add `PG_POOL_MAX=1` and `NODE_ENV=production` there too. Then create a preview first:

```powershell
vercel
```

Verify account registration/login, database persistence, Gemini chat and speech, weather, and the disease model on the preview URL. If those pass, publish:

```powershell
vercel --prod
```

## Important limits and checks

- Vercel Functions have a 4.5 MB request and response body limit. The image request is compressed in the browser before Gemini Vision; keep testing with ordinary phone/desktop leaf photos.
- The ONNX classifier and model weights download from Hugging Face/CDN in the user's browser; the deployed site needs outbound access to those public assets.
- Keep the production Supabase database accessible to Vercel and use a pooled connection string. Check Supabase's connection limits before inviting many users.
- After deployment, review Vercel function logs for PostgreSQL or provider errors. Do not paste secret values into logs or chat.
