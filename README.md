# AgriSathi — Nashik pilot

Desktop-first agriculture advisory prototype for Nashik district, Maharashtra. Uses live Open-Meteo forecasts, a PlantVillage-trained ONNX image classifier loaded from Hugging Face, and SQLite locally or PostgreSQL when configured. Marathi and English interface.

## Run

Requires Node.js 22.13 or later. Copy `.env.example` to `.env` only if configuring the optional paid Open-Meteo key. Run `npm start` from this directory, then open http://localhost:4173. See [API_SETUP.md](API_SETUP.md) for provider setup and limitations.

The database is created at `data/agrisathi.sqlite` when PostgreSQL is not configured. The disease model and ONNX Runtime Web are fetched on first use from the model publisher/CDN. Images are classified in the browser; if the user checks the explicit consent box, a compressed image is also sent server-side to Gemini Vision for a second screen. Advisory read-aloud and the Ask Gemini chat use server-side Gemini calls. The chat has English/Marathi text, microphone capture transcribed by Gemini 3.5 Transcribe, and Gemini TTS replies. Weather is fetched live from Open-Meteo. No synthetic weather or community submissions are preloaded.

**Deployment status:** the configured Supabase PostgreSQL connection and SQLite import have succeeded. A live Gemini Marathi TTS call returned audio, a recorded Marathi sample was transcribed by Gemini 3.5 Transcribe, and a real Marathi chat answer succeeded through Gemini 3.5 Flash-Lite. Gemini Vision still needs an actual consented crop-image check. Cloud deployment and restart-persistence verification remain. See [API_SETUP.md](API_SETUP.md) for the current checklist.

## Data access and limitations

- Weather: Open-Meteo live forecast for the selected farm coordinates, fetched through an authenticated backend route with attribution. Free API is for evaluation/non-commercial use; configure the paid key for commercial deployment.
- IMD: the documented IMD API endpoints returned HTTP 401 during implementation research. The app links to official IMD Agromet bulletins but does not fabricate their contents. Add an authorized IMD integration through a server-side adapter when credentials/access are available.
- Satellite: Sentinel-2 data are available through Copernicus, but its processing APIs require account/OAuth access. There is no satellite-derived vegetation index in this build. The data-sources view records this limitation.
- Soil: values must come from a Soil Health Card or lab test and are entered by the user. A photo cannot measure nutrients. No example tests are inserted.
- Crop advice: transparent starter rules and ICAR-linked references, not a validated agronomy model. Seed/community comparisons stay empty until users submit reports.
- Disease: analysis uses ONNX model `imaflower/plantvillage-mobilenetv3` (MIT model card) trained on PlantVillage. With explicit image-sharing consent, Gemini Vision can compare the photo with that model's crop-specific label list and report visible evidence. It is not an independent curated disease knowledge base or field-validated diagnosis. Model labels are checked against the selected crop; failures are shown without inventing results.
- Database: local SQLite by default, managed PostgreSQL via `DATABASE_URL`. The app applies user/farm authorization in backend queries. Keep the database URL server-side and use a dedicated, least-privileged database role for deployment.

## Security

Local accounts use scrypt password hashes and HTTP-only session cookies. SQL statements are parameterized. The app binds only to loopback by default. Before public deployment, verify HTTPS, least-privileged database credentials, CSRF protection, rate limits, image retention rules, and provider credentials in server-side secrets.
