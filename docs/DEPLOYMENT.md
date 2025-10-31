# Deployment Guide

## Deploying to Vercel

### Prerequisites
- GitHub account
- Vercel account (free tier works)
- Azure OpenAI account with credentials

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Initial MVP deployment"
git push origin main
```

### Step 2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Next.js

### Step 3: Configure Environment Variables

In Vercel dashboard → Settings → Environment Variables, add:

**Azure OpenAI:**
- `AZURE_OPENAI_API_KEY` - Your Azure OpenAI API key
- `AZURE_OPENAI_ENDPOINT` - https://your-resource.openai.azure.com/
- `AZURE_OPENAI_DEPLOYMENT_NAME` - Your GPT-4 deployment name (e.g., `gpt-4`)
- `AZURE_OPENAI_REALTIME_DEPLOYMENT_NAME` - Your Realtime API deployment (e.g., `gpt-4o-realtime-preview`)
- `AZURE_OPENAI_API_VERSION` - `2024-08-01-preview`

**Azure Speech:**
- `AZURE_SPEECH_KEY` - Your Speech Service key
- `AZURE_SPEECH_REGION` - Region (e.g., `japaneast`, `eastus`)

**Azure Storage (optional for audio):**
- `AZURE_STORAGE_CONNECTION_STRING` - Connection string
- `AZURE_STORAGE_CONTAINER_NAME` - Container name (e.g., `knowledge-harvest-audio`)

**Azure AI Search (optional for advanced features):**
- `AZURE_SEARCH_ENDPOINT` - https://your-search.search.windows.net
- `AZURE_SEARCH_API_KEY` - Admin API key
- `AZURE_SEARCH_INDEX_NAME` - Index name (e.g., `knowledge-harvest`)

**Database:**
- `DATABASE_URL` - For Vercel, use `/tmp/knowledge-harvest.db` (note: ephemeral) or use Vercel Postgres

> ⚠️ If you see an error like `Environment Variable "AZURE_OPENAI_API_KEY" references Secret "azure-openai-api-key", which does not exist.`, double-check that the variable exists under Project → Settings → Environment Variables for the Production, Preview, and Development targets. Vercel only injects variables that are scoped to the environment being deployed.

### Step 4: Deploy

Click "Deploy" - Vercel will build and deploy automatically.

### Step 5: Test

1. Visit your deployed URL (e.g., `your-app.vercel.app`)
2. Go to Dashboard → Click "Show Mock Data" to see demo
3. Test Seed page with company info
4. Verify documentation generation and export

---

## Database Considerations for Production

**Current Setup:** SQLite (ephemeral on Vercel serverless)

### Option 1: Vercel Postgres (Recommended for production)
```bash
vercel postgres create
```
Then update `DATABASE_URL` in environment variables.

### Option 2: Azure SQL Database
- Best for enterprise/Azure-native stack
- Update Drizzle config for PostgreSQL dialect

### Option 3: Turso (Distributed SQLite)
- SQLite with replication
- Good for global edge deployments

---

## Local Development

```bash
# Install dependencies
npm install

# Create .env.local from .env.example
cp .env.example .env.local

# Edit .env.local with your Azure credentials

# Run development server
npm run dev

# Open http://localhost:3000
```

---

## Troubleshooting

### Build fails with "Module not found"
- Run `npm install` to ensure all deps installed
- Check that all imports use `@/` alias correctly

### Azure OpenAI API errors
- Verify your API key and endpoint are correct
- Ensure deployment names match exactly
- Check API version compatibility

### Database errors on Vercel
- SQLite is ephemeral in serverless - data resets between deployments
- For persistence, migrate to Vercel Postgres or cloud database

### Realtime API not working
- Ensure `gpt-4o-realtime-preview` deployment is created
- Check that your Azure region supports Realtime API
- Verify WebRTC signaling (may need custom implementation)

---

## Next Steps After Deployment

1. **Test end-to-end flow** with real Azure credentials
2. **Set up persistent database** (Vercel Postgres/Azure SQL)
3. **Implement actual WebRTC signaling** for voice interviews
4. **Add authentication** (NextAuth.js, Clerk, or Auth0)
5. **Configure domain** (add custom domain in Vercel)
6. **Monitor usage** (Vercel Analytics, Azure Monitor)
7. **Set up CI/CD** (automatic deployment on git push)

---

## Cost Estimates (MVP Demo)

**Free Tier Included:**
- Vercel: Free hobby plan (100GB bandwidth, unlimited requests)
- Azure OpenAI: Pay-per-token (GPT-4: ~$0.03/1K tokens)
- Azure Speech: 5 hours free/month, then $1/hour

**Expected Monthly Costs for Light Demo Usage:**
- ~10-20 demo calls: $5-10 (OpenAI tokens)
- ~2 hours speech: Free tier or $2
- **Total: ~$5-15/month** for demo/PoC usage

---

## Security Checklist

- [ ] All API keys stored in environment variables (not in code)
- [ ] `.env.local` added to `.gitignore`
- [ ] Rate limiting configured for APIs
- [ ] Input validation on all user-submitted data
- [ ] PII redaction enabled before storing transcripts
- [ ] CORS properly configured for production domain
- [ ] Content Security Policy headers set
- [ ] HTTPS enforced (Vercel default)

---

## Support

For issues:
- Check [Next.js docs](https://nextjs.org/docs)
- Review [Azure OpenAI docs](https://learn.microsoft.com/azure/ai-services/openai/)
- Post in project GitHub Issues
