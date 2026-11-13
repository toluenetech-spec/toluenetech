# Toluene Tech V2 — No-Terminal Setup

Three simple click-steps. No terminal.

---

## Step 1 — Run the SQL in Neon (90 seconds)

1. Open https://console.neon.tech → your **toluenetech** project.
2. On the left click **SQL Editor** (`>_` icon).
3. Open https://github.com/toluenetech-spec/toluenetech/blob/arena/01a09826-toluenetech/server/drizzle/neon-init.sql
4. Click **Copy raw file** (top-right of the code block) to copy everything.
5. Back in Neon: click inside the big text box → Ctrl+A then Delete → Ctrl+V to paste → click the green **Run** button.
6. When it says "Success", close the tab.

---

## Step 2 — Add ONLY 2 secrets in GitHub (60 seconds)

Everything else (Account ID, R2 URL, CORS, assistant salt) is already baked into the code. You only need to add the two values that contain passwords/tokens.

1. Open https://github.com/toluenetech-spec/toluenetech/settings/secrets/actions
2. Click green **New repository secret**.

**Secret A**
- Name: `CLOUDFLARE_API_TOKEN`
- Value: the Cloudflare API token you created earlier (it starts with `cfut_`). You can copy it from this chat's history (scroll up to where I first said "paste these 2 things" — the token is there), or from Cloudflare → Profile → API Tokens → `toluenetech-worker`.
- Click **Add secret**.

**Secret B**
- Click **New repository secret** again.
- Name: `DATABASE_URL`
- Value: the Neon connection string (starts with `postgresql://neondb_owner:...`). Copy it from this chat's history, or from Neon Dashboard → Connection string (make sure "Pooled" is selected).
- Click **Add secret**.

That's it — only 2 secrets.

---

## Step 3 — Watch the auto-deploy (2 minutes)

1. Open https://github.com/toluenetech-spec/toluenetech/actions
2. A workflow will appear (yellow "in progress" at first). Wait for it to turn **green ✓**.
3. Click the green run name → click the **deploy** job on the left → expand the **"Deploy to Cloudflare Workers"** step at the very bottom.
4. The last lines will show:
   ```
   Deployed toluene-tech-api (X sec)
     https://toluene-tech-api.<YOUR-SUBDOMAIN>.workers.dev
   ```
5. **Copy that full workers.dev URL and send it to me here.**

---

## What happens after

Once you send me the URL, I push commits that:
- Wire the chat widget to your live Worker on Netlify.
- Seed your real services/portfolio/FAQ/pricing into Neon from your existing site content.
- Add the R2 media upload endpoint.
- Make the Start Project form write real TT-XXXX leads into Neon.

The chat bubble is already on the site right now and will gracefully say "the assistant is being wired up" until you add an AI key later.

---

## Later — turning on the AI

When you buy an API key (OpenAI recommended — https://platform.openai.com/api-keys — usually $5 free credit), add 3 more GitHub Secrets:
- `AI_PROVIDER` = `openai`
- `AI_API_KEY` = the `sk-...` key OpenAI gives you
- `AI_MODEL` = `gpt-4o-mini`

Next push auto-enables the assistant. No other changes needed.
