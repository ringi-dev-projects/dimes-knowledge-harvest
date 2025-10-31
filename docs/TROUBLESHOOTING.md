# Troubleshooting Guide

## Common Issues and Solutions

### 1. `better-sqlite3` Module Version Error

**Error Message:**
```
Error: The module 'better-sqlite3/build/Release/better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 131. This version of Node.js requires
NODE_MODULE_VERSION 127.
```

**Cause:**
The `better-sqlite3` native module was compiled for a different Node.js version.

**Solution:**
```bash
npm rebuild better-sqlite3
```

This will recompile the native module for your current Node.js version.

**Prevention:**
After switching Node.js versions (e.g., with nvm or asdf), always run:
```bash
npm rebuild
```

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

### 3. Database Connection Errors

**Error Message:**
```
Error: SQLITE_CANTOPEN: unable to open database file
```

**Solution:**
Ensure the `data` directory exists and has write permissions:
```bash
mkdir -p data
chmod 755 data
```

**Alternative:**
Set a specific database path in `.env.local`:
```
DATABASE_URL=/tmp/knowledge-harvest.db
```

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
   - If you see an error such as `Environment Variable "AZURE_OPENAI_API_KEY" references Secret "azure-openai-api-key", which does not exist.`, create the secret with `vercel env add AZURE_OPENAI_API_KEY production` (and repeat for preview/development).

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
