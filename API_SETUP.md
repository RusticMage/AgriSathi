# AgriSathi: 2-hour integration and deployment guide

## Current status — read this first

- The app is a Node.js desktop web app. Local setup can use SQLite; your configured instance now uses Supabase PostgreSQL.
- **PostgreSQL is connected and the SQLite import completed successfully.** The import checked 3 users, 2 sessions, 3 farms, 1 soil test, and 4 advisories; other source tables were empty. SQLite remains as a backup. Start the app and look for `Database: PostgreSQL`.
- **Gemini key and Marathi speech are verified.** A real Marathi TTS request returned playable audio using `gemini-3.8-flash-lite-tts`. A real Marathi text chat now succeeds through Gemini 3.5 Flash-Lite. The Gemini Vision route still needs a real leaf-photo check. The local PlantVillage ONNX classifier continues to run independently; Gemini vision is sent only after explicit photo-sharing consent.
- A new Ask Gemini page supports typed questions, microphone recording transcribed by Gemini 3.5 Transcribe, and Gemini spoken replies. Recording requires a browser with MediaRecorder support and microphone permission; short recordings are sent to Gemini, are not stored by AgriSathi, and the app requests deletion of the temporary uploaded file. The API key remains server-side.
- Open-Meteo is the only live external data provider connected. The free, no-key endpoint is used for evaluation.
- **Cloud deployment is not yet completed.** Do not deploy until you verify account login, restart persistence, mic permission and transcription in your browser, and the leaf-photo flow. The server supports Cloud Run's port/host and secure production cookies.

This guide separates account setup you can do now from code that still must be completed. Do not paste secrets into chat or commit them to the project.

## Priority for the next 2 hours

1. Refresh the browser tab and test one English and one Marathi chat question.
2. Click **Speak**, allow microphone access, record a short question, then press **Stop recording**; confirm the transcript is sent and the answer is spoken.
3. In **Disease lab**, run the published image model, then explicitly consent to Gemini image analysis and test with a clear Tomato or Grape leaf photo.
4. Verify an existing imported account can sign in and its records survive an app restart.
5. Choose **Google Cloud Run** for deployment and verify secrets and production settings. Skip IMD and satellite integrations for this deadline. Open-Meteo already supplies a real forecast; IMD returned 401 without authorized access, and satellite processing needs a separate account and plot boundary.

## 1. Get the Gemini API key

1. Open [Google AI Studio API keys](https://aistudio.google.com/app/apikey) and sign in.
2. Create an API key in a Google AI Studio project. The same Gemini API key can be used for image understanding and TTS; these do not need separate keys.
3. Restrict the key to the Gemini API where AI Studio offers that option. Check usage and billing/rate limits in AI Studio before the demo.
4. Copy the key into the local `.env` file as `GEMINI_API_KEY=...`. Do not put it in `public/app.js`, HTML, a screenshot, or a message.

Official setup: [Gemini API quickstart](https://ai.google.dev/gemini-api/docs/get-started) and [API key security](https://ai.google.dev/gemini-api/docs/api-key).

### Gemini vision flow in the UI (live leaf-photo verification remains)

The user selects a crop, runs the browser ONNX classifier, and may separately opt in to send a compressed copy of the leaf image to Gemini. The server limits Gemini's response to labels for that crop from the downloaded PlantVillage classifier label list (or `unknown`), plus visible evidence and an uncertainty flag. No image is stored by this app. A Gemini failure is shown as a failure; the independent local result remains visible. Both are screening signals, not a confirmed diagnosis or treatment recommendation. **This is constrained to PlantVillage labels; it is not a separately curated disease-reference database.**

Gemini image input is documented at [Image understanding](https://ai.google.dev/gemini-api/docs/image-understanding); structured responses are documented at [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output).

**Image privacy:** this design sends the selected image to Google's Gemini API for analysis. The screen must say that before upload and require an explicit user action. Do not save the image unless the user separately opts in; save only the result metadata needed for farm history.

### Gemini chat and voice

Open **Ask Gemini** in the sidebar. Text messages go to Gemini with the signed-in farmer's profile, farm location/crop, and latest saved soil test as context. The chat is not stored in the database. The browser records a short voice message; Gemini 3.5 Transcribe recognizes Marathi or English, and the transcribed question is sent to chat. Gemini produces the answer, and its **Listen** button uses Gemini TTS. The app asks Gemini to delete the uploaded audio when transcription finishes. The API key stays on the server. A live Marathi chat answer and Gemini transcription of a Marathi audio sample have both succeeded. Test the microphone capture in your browser before deployment. Provider rate limits may still require retrying.

### Gemini read-aloud (live Marathi audio verified)

1. The app creates a source-backed weather summary in the selected interface language. Marathi users get a Marathi transcript.
2. Press **Read aloud with Gemini** to send the text to the server-side TTS route.
3. The browser plays returned audio with its native controls; the visible advisory remains the transcript.

Use `gemini-3.8-flash-lite-tts` for a quick read-aloud feature, or `gemini-3.8-flash-tts` if voice quality is the priority. Gemini documents Marathi as supported for both models. See [Gemini text-to-speech](https://ai.google.dev/gemini-api/docs/speech-generation). Test Marathi agricultural names with a fluent speaker before presenting the audio as reviewed.

## 2. Create the PostgreSQL database

Recommended fast option: [create a Supabase project](https://supabase.com/dashboard).

1. Create a project and keep its database password private.
2. In the project dashboard, open **Connect** and copy a PostgreSQL connection string. Put it in local `.env` as `DATABASE_URL=...`.
3. For a long-running Cloud Run service, Supabase recommends a direct connection where IPv6 is available; use the shared session pooler when the deployment network is IPv4-only. Copy the exact string from the dashboard rather than constructing the hostname yourself. See [Supabase connection options](https://supabase.com/docs/guides/database/connecting-to-postgres).
4. Keep the connection string server-only. With the current custom Node backend and server-side database access, a browser publishable key is not required for the PostgreSQL connection. Never put a Supabase secret/service-role key in frontend code.

### Connect PostgreSQL and copy local records

The server now uses the `pg` connection pool when `DATABASE_URL` is present. It creates the app tables and indexes at startup. Without that variable, it keeps using `data/agrisathi.sqlite` for local development.

To switch while retaining existing local accounts and records:

1. A Supabase project and server-side `DATABASE_URL` are already configured in this local `.env`; keep the connection string secret.
2. `npm run db:import-sqlite` has completed successfully. Do not repeat it unless you intentionally need to copy additional SQLite rows; keep `data/agrisathi.sqlite` as the backup.
3. Restart the app with `npm start`. Startup should print `Database: PostgreSQL`; if connection or schema setup fails, it exits with an error rather than silently falling back to SQLite.
4. Sign in with an existing account and verify farm history. Restart the app once and confirm those records remain.

If the import command cannot connect, check the connection string, project status, network access, and whether you copied a direct or pooler URL supported by your runtime. Do not run the app with a production URL until the import has finished.

The connection uses node-postgres parameterized queries and a small pool. The app still applies farm ownership checks in backend routes. For public deployment, use a dedicated database role with only the permissions the app needs; do not put any database credential in frontend code.

## 3. Google Cloud Run deployment

Cloud Run is the proposed host, not yet a completed deployment.

Before deploying, the code must:

- set `DATABASE_URL` and verify the startup log says PostgreSQL rather than SQLite;
- set a server-only database connection secret (for example, from Secret Manager);
- keep PostgreSQL and Gemini secrets server-side in Secret Manager;
- use `GEMINI_API_KEY` and `DATABASE_URL` only from server environment/secrets;
- handle provider timeouts/rate limits and cap image size before sending it to Gemini.

The server now uses Cloud Run's injected port and binds to `0.0.0.0` when it detects the Cloud Run environment. Set `NODE_ENV=production` in the deployed service so authentication cookies include `Secure`. Local runs still bind only to `127.0.0.1` by default.

After these are done, from the app directory, the standard source deployment path is `gcloud run deploy --source .`. Follow the [Cloud Run Node.js deployment guide](https://docs.cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-nodejs-service). Put keys in Secret Manager or the Cloud Run secret configuration; do not put literal secret values in the deploy command history or source files.

## 4. Local `.env` setup

From PowerShell in this app folder:

```powershell
Copy-Item .env.example .env
notepad .env
```

Your local `.env` already contains the Gemini key and Supabase `DATABASE_URL`. Keep both private. Leave `OPEN_METEO_API_KEY` blank for the no-key prototype endpoint. Restart the local app after changing `.env`.

`.env` is excluded from Git. If a secret is exposed, revoke/rotate it in the provider dashboard.

## 5. What not to spend the 2-hour window on

- **Open-Meteo key:** not needed for the current prototype. Its free tier is non-commercial and has no uptime guarantee; review the [terms](https://open-meteo.com/en/pricing) before public/commercial use.
- **IMD key:** no successful authorized feed is configured. The documented API returned 401 in our earlier check. Registration may not grant endpoint access; request the exact API entitlement/auth instructions from IMD first.
- **Copernicus/Sentinel satellite access:** not connected and not required for the essential flow. It requires a Copernicus account/OAuth client and a farm boundary.
- **Separate Google Cloud Translation key:** not needed for Gemini TTS. The app needs to have a Marathi transcript to speak; TTS itself does not translate.

## Final acceptance checklist before sharing a deployment URL

- [ ] Startup reports PostgreSQL; existing account can sign in, and new farm/soil/crop/advisory records survive an app restart.
- [ ] Generate a current weather forecast and show source plus fetch time.
- [ ] Submit a leaf image only after the consent notice; Gemini result is constrained to active PlantVillage crop labels or `unknown`. Current code does not save or upload the image to this app's database.
- [ ] Verify a Marathi advisory transcript and hear it through Gemini TTS; play, pause/stop, and transcript all work.
- [ ] Verify missing keys and upstream failures show a clear unavailable message, not fabricated data or a fake success.
- [ ] Check that no API key appears in browser source/network responses or the Git repository.
- [ ] Test the deployed service in a second browser and after redeployment to confirm shared PostgreSQL data persists.

