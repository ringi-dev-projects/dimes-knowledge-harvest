# Troubleshooting Guide

## Common Issues and Solutions

### 1. Postgres Connection Error

**Error Message:**
```
error: password authentication failed for user "neondb_owner"
```
or
```
Error: SASL: SCRAM authentication failed
```

**Cause:**
- `DATABASE_URL` not set or contains the wrong credentials
- `sslmode=require` missing on Vercel Postgres (Neon)
- Using the pooled URL (`...-pooler...`) in a context that requires a direct connection

**Solution:**
- Verify `DATABASE_URL` in `.env.local` and Vercel → Environment Variables matches the value shown in the Vercel Postgres dashboard (`postgresql://...sslmode=require`).
- If migrations complain about pgbouncer, use `DATABASE_URL_UNPOOLED` locally and `DIRECT_URL`/`POSTGRES_URL_NON_POOLING` for tools that need a direct connection.
- After updating variables run:
  ```bash
  vercel env pull .env.vercel
  ```
  so local development matches production.

---

### 2. Port Already in Use

**Error Message:**
```
⚠ Port 3000 is in use by process XXXXX, using available port 3001 instead.
```

**Solution:**
Either:
- Use the suggested port (e.g., `http://localhost:3001`)
- Kill the process using port 3000:
  ```bash
  lsof -ti:3000 | xargs kill -9
  ```

---

### 3. Database Connection Errors (Local Development)

**Error Message:**
```
error: self signed certificate in certificate chain
```

**Solution:**
- Ensure you are using the Neon URL that includes `sslmode=require` so TLS is handled automatically.
- If you need to run the database with pooling disabled (for migrations or scripts), use the `DATABASE_URL_UNPOOLED` value Vercel provides. Set it in a terminal session before running Drizzle commands:
  ```bash
  export DATABASE_URL="postgresql://...ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
  ```
- Double-check that your local network/firewall allows outbound connections on port 5432.

---

### 4. Azure OpenAI API Errors

**Error Message:**
```
Error: 401 Unauthorized
Error: No response from AI
```

**Solutions:**

1. **Check environment variables:**
   ```bash
   cat .env.local | grep AZURE_OPENAI
   ```

2. **Verify credentials:**
   - `AZURE_OPENAI_API_KEY` - Must be valid
   - `AZURE_OPENAI_ENDPOINT` - Must end with `/` (e.g., `https://your-resource.openai.azure.com/`)
   - `AZURE_OPENAI_DEPLOYMENT_NAME` - Must match your Azure deployment

3. **Test API directly:**
   ```bash
   curl -X POST "$AZURE_OPENAI_ENDPOINT/openai/deployments/$AZURE_OPENAI_DEPLOYMENT_NAME/chat/completions?api-version=2024-08-01-preview" \
     -H "api-key: $AZURE_OPENAI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"Hello"}]}'
   ```

---

### 5. Mock Data Not Loading

**Issue:** Dashboard shows "No coverage data yet" even with mock=true

**Solutions:**

1. **Check URL parameter:**
   ```
   http://localhost:3001/dashboard
   ```
   Then click "Show Mock Data" button

2. **Test API directly:**
   ```bash
   curl http://localhost:3001/api/coverage?mock=true
   ```

3. **Clear browser cache:**
   - Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

---

### 6. Build Warnings About React Hooks

**Warning:**
```
Warning: React Hook useEffect has a missing dependency: 'loadMetrics'
```

**Note:** These are warnings, not errors. The app will still work.

**To fix (optional):**
Either add the dependency to the array or disable the rule:
```tsx
// Option 1: Add dependency
useEffect(() => {
  loadMetrics();
}, [loadMetrics, useMockData]);

// Option 2: Disable for that line
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  loadMetrics();
}, [useMockData]);
```

---

### 7. TypeScript Errors After Fresh Install

**Solution:**
```bash
# Clean and rebuild
rm -rf .next node_modules
npm install
npm run build
```

---

### 8. Vercel Deployment Fails

**Common Causes:**

1. **Missing environment variables**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Add all variables from `.env.example`
   - Ensure each variable is scoped to the environment you are deploying (Production/Preview/Development). If Vercel shows `Environment Variable "AZURE_OPENAI_API_KEY" references Secret "azure-openai-api-key", which does not exist.`, the build target is missing that variable.

2. **Build errors**
   - Check Vercel build logs
   - Ensure `npm run build` works locally first

3. **Node.js version mismatch**
   - Add to `package.json`:
     ```json
     "engines": {
       "node": ">=18.0.0"
     }
     ```

---

### 9. CORS Errors in Production

**Error:**
```
Access to fetch at 'https://your-app.vercel.app/api/...' has been blocked by CORS
```

**Solution:**
Add CORS headers to API routes:
```ts
export async function GET(request: NextRequest) {
  const response = NextResponse.json({ ... });
  response.headers.set('Access-Control-Allow-Origin', '*');
  return response;
}
```

---

### 10. Database Resets on Vercel

**Issue:** SQLite database resets between deployments

**Why:** Vercel serverless functions are ephemeral

**Solutions:**

1. **Use Vercel Postgres (recommended):**
   ```bash
   vercel postgres create
   ```

2. **Use Turso (distributed SQLite):**
   - Sign up at https://turso.tech
   - Get connection URL
   - Update `DATABASE_URL` in Vercel

3. **Use Azure SQL Database:**
   - Create Azure SQL Database
   - Update Drizzle config for PostgreSQL
   - Update connection string

### 11. ENOENT: `/var/task/data` (Vercel)

**Error:**
```
Failed to initialize database: Error: ENOENT: no such file or directory, mkdir '/var/task/data'
```

**Cause:** Vercel's serverless filesystem is read-only except for `/tmp`. If `DATABASE_URL` is missing (or points to a relative path), the app tries to create `data/` inside `/var/task`, which fails.

**Fix:**
- In Vercel → Project → Settings → Environment Variables, set `DATABASE_URL` to `/tmp/knowledge-harvest.db` for Production/Preview/Development.
- Redeploy so the updated environment variable is picked up.
- For persistent storage, switch to Vercel Postgres (see [Database Resets on Vercel](#10-database-resets-on-vercel)).

### 12. FOREIGN KEY constraint failed (Realtime Session)

**Error:**
```
SqliteError: FOREIGN KEY constraint failed
```

**Cause:** The interview route (`/api/realtime/session`) creates a row in `interview_sessions` that references the selected company. If the SQLite database has been reset (common on Vercel), the company record may no longer exist. The request still sends the old ID from `localStorage`, which trips the foreign key constraint.

**Fix:**
- Re-seed the company profile (Dashboard → Seed Topic Map) so a fresh company row exists.
- Or use the “Show Mock Data” workflow again to create demo records.
- After re-seeding, retry starting the interview. The API now returns a clear `404 Company record not found` response so the UI can prompt you to re-seed instead of failing silently.

### 13. Audio Upload Fails on Vercel

**Error:**
```
ENOENT: no such file or directory, mkdir '/var/task/data'
```

**Cause:** Vercel's read-only filesystem blocks writing under the project directory. Without Azure Blob storage credentials the app falls back to local storage (dev only) and returns `audioUrl: null` in production.

**Fix:**
- Provide `AZURE_STORAGE_CONNECTION_STRING` and `AZURE_STORAGE_CONTAINER_NAME` so uploads go to Azure Blob Storage.
- For demos without persistent storage, treat the missing `audioUrl` as expected behaviour.

---

## Quick Diagnostics

Run these commands to check your setup:

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Verify dependencies installed
npm list --depth=0

# Test build
npm run build

# Test dev server
npm run dev

# Test API endpoint
curl http://localhost:3001/api/coverage?mock=true
```

---

## Getting Help

1. **Check logs:**
   - Browser Console (F12)
   - Terminal output
   - Vercel deployment logs

2. **Verify environment:**
   ```bash
   cat .env.local
   ```

3. **GitHub Issues:**
   - Search existing issues
   - Create new issue with error logs

4. **Documentation:**
   - [README.md](./README.md) - Quick start
   - [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
   - [MVP-SUMMARY.md](./MVP-SUMMARY.md) - Feature overview

---

## Still Having Issues?

Create a GitHub issue with:
- Error message (full stack trace)
- Steps to reproduce
- Your environment:
  ```bash
  node --version
  npm --version
  cat package.json | grep version
  ```
