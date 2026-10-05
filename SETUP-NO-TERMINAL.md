# Toluene Tech V2 — No-Terminal Setup

You don't need to open a terminal. Everything is done by clicking in the browser.

---

## Step 1 — Create the database tables in Neon (2 minutes)

1. Open [console.neon.tech](https://console.neon.tech) and go to your **toluenetech** project.
2. On the left sidebar click **"SQL Editor"** (icon looks like `>_`).
3. On this repo on GitHub, open the file `server/drizzle/neon-init.sql`.
4. Click the **"Copy raw file"** button (top-right of the file view) to copy ALL the SQL.
5. Back in Neon's SQL Editor, **paste everything** into the big text box (select and delete any existing text first so it's empty).
6. Click the green **"Run"** button at the top.
7. You should see a success message — all 22 tables are now created. You can close the tab.

---

## Step 2 — Give GitHub permission to deploy to Cloudflare (one time)

These values are stored **encrypted** in your GitHub repo and never shown again.

1. Go to your GitHub repo: `https://github.com/toluenetech-spec/toluenetech`
2. Click **Settings** (top tab).
3. On the left sidebar: **Secrets and variables → Actions**.
4. Click the **"Secrets"** tab (should already be selected), then click the green **"New repository secret"** button.
5. Add **each** of the following 7 secrets. One per submission. Click "Add secret" after each, then click "New repository secret" for the next.

### Secret 1
- **Name:** `CLOUDFLARE_API_TOKEN`
- **Secret:** (paste the Cloudflare API token you created earlier — it starts with `cfut_` — *do not* commit it anywhere, only paste it into this GitHub Secrets box)

### Secret 2
- **Name:** `CLOUDFLARE_ACCOUNT_ID`
- **Secret:**
  ```
  5ba6343e7dbce7708785cffe6d9e55ae
  ```

### Secret 3
- **Name:** `DATABASE_URL`
- **Secret:** (paste the Neon connection string you copied earlier — starts with `postgresql://neondb_owner:...`)
  - Only paste it into this GitHub Secrets box — don't paste it anywhere else.

### Secret 4
- **Name:** `ASSISTANT_SECRET`
- **Secret:**
  ```
  00d40a3066b3c508631b9b45cfc580a5cc262358f4213a3df0eb54a7499aa94a
  ```

### Secret 5
- **Name:** `CORS_ORIGIN`
- **Secret:**
  ```
  http://localhost:5173,https://curious-sprinkles-59674e.netlify.app,https://toluenetech.com
  ```

### Secret 6
- **Name:** `R2_PUBLIC_URL`
- **Secret:**
  ```
  https://pub-3ba2d6d48fc941ae93a9328a913b8b85.r2.dev
  ```

### Secret 7 (leave blank for now — the assistant will show a "not connected yet" message)
- **Name:** `AI_PROVIDER`
- **Secret:** (leave empty — don't create this one yet)
- Same for `AI_API_KEY` and `AI_MODEL` — skip them for now.

---

## Step 3 — Watch the auto-deploy happen (2 minutes)

Once you add Secret 6 (the last one), GitHub will automatically start deploying the Worker.

1. On GitHub, click the **Actions** tab (top).
2. You'll see a workflow running called something like **"chore: setup auto-deploy via GitHub Actions"** or similar.
3. Wait for it to turn green ✓ (usually ~90 seconds).
4. Click the green run to open it, then click the job name **"deploy"** on the left.
5. Expand the last step **"Deploy to Cloudflare Workers"**. It ends with a line like:
   ```
   Deployed toluene-tech-api (X sec)
     https://toluene-tech-api.<YOUR-SUBDOMAIN>.workers.dev
   ```
6. **Copy that workers.dev URL** and paste it to me.

---

## Step 4 — Verify

Open that workers.dev URL in your browser and add `/healthz` at the end, e.g.:
```
https://toluene-tech-api.<YOUR-SUBDOMAIN>.workers.dev/healthz
```
You should see:
```json
{"ok":true,"db":"ok","ai":"unconfigured","version":"0.1.0",...}
```
- `"db":"ok"` ✅ Neon + Worker are connected
- `"ai":"unconfigured"` ✅ normal — chat bubble gracefully says the assistant is being wired up

---

## Step 5 — I'll wire the live URL into the frontend

Send me the workers.dev URL and I'll push one more commit:
- Sets `VITE_API_URL` so the chat widget talks to your live Worker on Netlify too (not just local dev).
- Seeds your real services/portfolio/faq/pricing data into Neon (pulled from your current site) so the assistant has real answers.
- Adds the admin upload endpoint and Start-Project lead capture to Neon.

---

## Adding the AI later (when you're ready)

When you buy an API key (OpenAI recommended — $5 free credit to start), just come back to **Settings → Secrets and variables → Actions** and add three more secrets:
- `AI_PROVIDER` = `openai` (or `anthropic` / `gemini`)
- `AI_API_KEY` = the key they give you
- `AI_MODEL` = `gpt-4o-mini`

That's it. The next push auto-deploys with a live assistant. No other changes needed.
