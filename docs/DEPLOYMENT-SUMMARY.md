# Azure Container Apps Deployment - Quick Start

## 📦 Files Created for Azure Deployment

### 1. **Dockerfile** - Multi-stage Docker build
- ✅ Production-optimized build
- ✅ Handles `better-sqlite3` native module
- ✅ Non-root user for security
- ✅ ~200MB final image size

### 2. **.dockerignore** - Excludes unnecessary files
- ✅ Speeds up build
- ✅ Reduces image size

### 3. **deploy-azure.sh** - Automated deployment script
- ✅ One-command deployment
- ✅ Creates all Azure resources
- ✅ Handles authentication
- ✅ Pushes Docker image
- ✅ Deploys container app

### 4. **update-azure.sh** - Quick update script
- ✅ Rebuild and push new image
- ✅ Update running container
- ✅ Zero-downtime deployment

### 5. **next.config.ts** - Updated for standalone output
- ✅ Enables Docker deployment
- ✅ Optimizes build size

### 6. **.env.local** - Fixed Azure OpenAI endpoint
- ✅ Corrected endpoint URL (removed realtime path)

---

## 🚀 Quick Deployment

### Prerequisites Check
```bash
# Install Azure CLI (Mac)
brew install azure-cli

# Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop

# Verify installations
az --version
docker --version
```

### One-Command Deployment
```bash
# Make scripts executable
chmod +x deploy-azure.sh update-azure.sh

# Deploy (takes ~10-15 minutes)
./deploy-azure.sh
```

The script will:
1. ✅ Login to Azure
2. ✅ Create resource group: `timelyhero`
3. ✅ Create Azure Container Registry
4. ✅ Build Docker image
5. ✅ Push to registry
6. ✅ Create Container Apps environment
7. ✅ Deploy your app
8. ✅ Output your live URL

---

## 📝 What Gets Created

### Azure Resources

| Resource | Name | Purpose |
|----------|------|---------|
| Resource Group | `timelyhero` | Container for all resources |
| Container Registry | `kharvest{timestamp}` | Stores Docker images |
| Container App Environment | `kh-env` | Managed environment |
| Container App | `knowledge-harvest` | Your running app |

### Cost Estimate
- **Development/Demo**: ~$10-20/month
- **Production (with traffic)**: ~$50-150/month
- First 180K vCPU-seconds FREE each month

---

## 🔄 Updating Your Deployment

After making code changes:

```bash
./update-azure.sh
```

This will:
1. Build new Docker image
2. Push to registry
3. Update container app
4. Roll out with zero downtime

---

## 🌐 Your Environment Variables

Already configured from your `.env.local`:

```bash
✅ AZURE_OPENAI_API_KEY
✅ AZURE_OPENAI_ENDPOINT (fixed)
✅ AZURE_OPENAI_DEPLOYMENT_NAME (gpt-4o)
✅ AZURE_OPENAI_REALTIME_DEPLOYMENT_NAME (gpt-realtime)
✅ AZURE_SPEECH_KEY
✅ AZURE_SPEECH_REGION (eastus)
✅ AZURE_STORAGE_CONNECTION_STRING
✅ AZURE_SEARCH_ENDPOINT
✅ AZURE_SEARCH_API_KEY
```

---

## 🧪 Testing After Deployment

```bash
# Get your URL (script outputs this)
APP_URL="your-app.kindocean-xxxx.eastus2.azurecontainerapps.io"

# Test homepage
curl https://$APP_URL

# Test API with mock data
curl https://$APP_URL/api/coverage?mock=true

# Open in browser
open https://$APP_URL
```

---

## 📊 Monitoring

### View Logs
```bash
az containerapp logs show \
  --name knowledge-harvest \
  --resource-group timelyhero \
  --follow
```

### Check Status
```bash
az containerapp show \
  --name knowledge-harvest \
  --resource-group timelyhero \
  --query "properties.runningStatus" \
  --output tsv
```

### List Revisions
```bash
az containerapp revision list \
  --name knowledge-harvest \
  --resource-group timelyhero \
  --output table
```

---

## 🔧 Manual Commands (Alternative to Scripts)

If you prefer step-by-step manual deployment, see:
- **[AZURE-CONTAINER-APPS-DEPLOYMENT.md](./AZURE-CONTAINER-APPS-DEPLOYMENT.md)** - Complete manual guide

---

## 🗑️ Cleanup

To delete all Azure resources:

```bash
az group delete --name timelyhero --yes --no-wait
```

This removes:
- Container Apps
- Container Registry
- All images
- Environment

**Cost stops immediately after deletion.**

---

## ⚠️ Important Notes

### Database
- Current setup uses **ephemeral SQLite** (resets on restart)
- For persistence, use:
  - Azure File Share mount (instructions in full guide)
  - Azure Database for PostgreSQL
  - Azure Cosmos DB

### Scaling
- Auto-scales: 1-3 replicas by default
- Modify in `deploy-azure.sh` for different scale

### Cold Starts
- First request after idle may take 2-3 seconds
- Set `--min-replicas 1` to keep always warm

---

## 📚 Full Documentation

- **[AZURE-CONTAINER-APPS-DEPLOYMENT.md](./AZURE-CONTAINER-APPS-DEPLOYMENT.md)** - Complete deployment guide
  - Manual step-by-step instructions
  - Database migration options
  - Custom domain setup
  - CI/CD configuration
  - Advanced scaling rules
  - Cost optimization tips

- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues and solutions

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Vercel deployment (alternative)

---

## ✅ Deployment Checklist

Before deploying:

- [ ] Azure CLI installed
- [ ] Docker installed and running
- [ ] Logged in to Azure (`az login`)
- [ ] `.env.local` configured with Azure credentials
- [ ] `deploy-azure.sh` is executable
- [ ] Built and tested locally (`npm run build`)

After deployment:

- [ ] App URL accessible
- [ ] API endpoints working (`/api/coverage?mock=true`)
- [ ] Mock data displays on dashboard
- [ ] Topic generation works (with Azure OpenAI)
- [ ] Logs show no errors

---

## 🎯 Next Steps

1. **Deploy**: Run `./deploy-azure.sh`
2. **Test**: Visit your app URL
3. **Demo**: Use mock data mode for presentations
4. **Monitor**: Check logs and metrics
5. **Update**: Use `./update-azure.sh` for changes
6. **Scale**: Adjust replicas as needed
7. **Persist**: Migrate to Azure Database if needed

---

## 🆘 Support

### Quick Help
- Deployment fails? Check `az containerapp logs`
- Image won't build? Ensure Docker is running
- Environment variables missing? Verify `.env.local`

### Documentation
- [Azure Container Apps Docs](https://learn.microsoft.com/azure/container-apps/)
- [Next.js Docker Guide](https://nextjs.org/docs/deployment#docker-image)
- [Project README](./README.md)

### Your Configuration
- Resource Group: `timelyhero`
- Region: `eastus2`
- Container App: `knowledge-harvest`

---

**Ready to deploy? Run `./deploy-azure.sh` and you'll be live in ~15 minutes!** 🚀
