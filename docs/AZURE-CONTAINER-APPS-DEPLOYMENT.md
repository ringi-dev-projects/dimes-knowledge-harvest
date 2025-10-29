# Azure Container Apps Deployment Guide

Complete guide to deploying Knowledge Harvest MVP to Azure Container Apps with full Next.js support and persistent database.

---

## Prerequisites

- Azure CLI installed: `brew install azure-cli` (Mac) or [Download](https://aka.ms/azure-cli)
- Docker installed and running
- Azure subscription with Container Apps enabled
- Azure OpenAI service configured

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Azure Container Apps                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Knowledge Harvest Next.js App (Docker Container)    │  │
│  │  - Port 3000                                          │  │
│  │  - Auto-scaling: 1-10 replicas                       │  │
│  │  - Environment variables injected                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              ↓
         ┌────────────────────────────────────────┐
         │      Azure Container Registry          │
         │  kharvest.azurecr.io/knowledge-harvest │
         └────────────────────────────────────────┘
                              ↓
    ┌──────────────┬──────────────┬─────────────────┐
    │ Azure OpenAI │ Azure Speech │ Azure Storage   │
    └──────────────┴──────────────┴─────────────────┘
```

---

## Step 1: Login to Azure

```bash
# Login to Azure
az login

# Set your subscription (if you have multiple)
az account list --output table
az account set --subscription "Your Subscription Name"

# Set variables for convenience
RESOURCE_GROUP="knowledge-harvest-rg"
LOCATION="eastus2"  # Same region as your Azure OpenAI
ACR_NAME="kharvest"  # Must be globally unique
CONTAINER_APP_NAME="knowledge-harvest"
ENVIRONMENT_NAME="kh-env"
```

---

## Step 2: Create Resource Group

```bash
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION
```

---

## Step 3: Create Azure Container Registry

```bash
# Create ACR
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# Login to ACR
az acr login --name $ACR_NAME

# Get ACR credentials (save these!)
az acr credential show --name $ACR_NAME
```

**Save the credentials:**
- Username: `kharvest`
- Password: (use `password` from output)

---

## Step 4: Build and Push Docker Image

```bash
# Build the Docker image
docker build -t knowledge-harvest:latest .

# Tag for ACR
docker tag knowledge-harvest:latest $ACR_NAME.azurecr.io/knowledge-harvest:latest

# Push to ACR
docker push $ACR_NAME.azurecr.io/knowledge-harvest:latest

# Verify push
az acr repository list --name $ACR_NAME --output table
```

**Troubleshooting:**
If push fails, ensure Docker is running and you're logged in:
```bash
docker login $ACR_NAME.azurecr.io
# Use credentials from Step 3
```

---

## Step 5: Create Container Apps Environment

```bash
# Create environment
az containerapp env create \
  --name $ENVIRONMENT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION
```

This takes 3-5 minutes to provision.

---

## Step 6: Create Azure File Share (Optional - For Persistent SQLite)

If you want SQLite to persist across deployments:

```bash
# Create storage account
STORAGE_ACCOUNT="khstorage$RANDOM"

az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS

# Create file share
az storage share create \
  --name knowledge-data \
  --account-name $STORAGE_ACCOUNT

# Get connection string
STORAGE_KEY=$(az storage account keys list \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query "[0].value" -o tsv)
```

---

## Step 7: Deploy Container App

### Option A: Without Persistent Storage (Ephemeral SQLite)

```bash
az containerapp create \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_NAME.azurecr.io/knowledge-harvest:latest \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $ACR_NAME \
  --registry-password $(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv) \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 1.0 \
  --memory 2.0Gi \
  --env-vars \
    "AZURE_OPENAI_API_KEY=9N7PQaPw1a6eYcgOUBSBCO1XKVxg6m0ZeucyGPz2B6Po8bf40H8AJQQJ99BIACHYHv6XJ3w3AAAAACOGghyF" \
    "AZURE_OPENAI_ENDPOINT=https://yerzh-mfwgao1d-eastus2.openai.azure.com/" \
    "AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o" \
    "AZURE_OPENAI_REALTIME_DEPLOYMENT_NAME=gpt-realtime" \
    "AZURE_OPENAI_API_VERSION=2024-08-01-preview" \
    "AZURE_SPEECH_KEY=53ef5180b5f542cbb1dd75e6b1e682b4" \
    "AZURE_SPEECH_REGION=eastus" \
    "AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=thproduction;AccountKey=VpG3NBqjUKRFZg9t66J8F+++dDNuwwe4pj24dbk6hvM31lr5Cw/v90tXzLnpB0Q194XvkQsNwzpR+AStRFHXDg==;EndpointSuffix=core.windows.net" \
    "AZURE_STORAGE_CONTAINER_NAME=knowledge-harvest-audio" \
    "AZURE_SEARCH_ENDPOINT=https://g6dqyuojuedd99296b.search.windows.net" \
    "AZURE_SEARCH_API_KEY=onM690fMKScguZYcMSXEzB8ijiOUucilpn49VNJuYDAzSeD1FgEz" \
    "AZURE_SEARCH_INDEX_NAME=knowledge-harvest" \
    "DATABASE_URL=/app/data/knowledge-harvest.db" \
    "NODE_ENV=production"
```

### Option B: With Persistent Storage (Recommended)

First, create a storage mount:

```bash
az containerapp create \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_NAME.azurecr.io/knowledge-harvest:latest \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $ACR_NAME \
  --registry-password $(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv) \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 1.0 \
  --memory 2.0Gi \
  --env-vars \
    "AZURE_OPENAI_API_KEY=9N7PQaPw1a6eYcgOUBSBCO1XKVxg6m0ZeucyGPz2B6Po8bf40H8AJQQJ99BIACHYHv6XJ3w3AAAAACOGghyF" \
    "AZURE_OPENAI_ENDPOINT=https://yerzh-mfwgao1d-eastus2.openai.azure.com/" \
    "AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o" \
    "AZURE_OPENAI_REALTIME_DEPLOYMENT_NAME=gpt-realtime" \
    "AZURE_OPENAI_API_VERSION=2024-08-01-preview" \
    "AZURE_SPEECH_KEY=53ef5180b5f542cbb1dd75e6b1e682b4" \
    "AZURE_SPEECH_REGION=eastus" \
    "AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=thproduction;AccountKey=VpG3NBqjUKRFZg9t66J8F+++dDNuwwe4pj24dbk6hvM31lr5Cw/v90tXzLnpB0Q194XvkQsNwzpR+AStRFHXDg==;EndpointSuffix=core.windows.net" \
    "AZURE_STORAGE_CONTAINER_NAME=knowledge-harvest-audio" \
    "AZURE_SEARCH_ENDPOINT=https://g6dqyuojuedd99296b.search.windows.net" \
    "AZURE_SEARCH_API_KEY=onM690fMKScguZYcMSXEzB8ijiOUucilpn49VNJuYDAzSeD1FgEz" \
    "AZURE_SEARCH_INDEX_NAME=knowledge-harvest" \
    "DATABASE_URL=/data/knowledge-harvest.db" \
    "NODE_ENV=production"

# Add storage mount
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars "DATABASE_URL=/mnt/data/knowledge-harvest.db"
```

---

## Step 8: Get Application URL

```bash
# Get the fully qualified domain name (FQDN)
az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  --output tsv
```

Example output: `knowledge-harvest.kindocean-12345678.eastus2.azurecontainerapps.io`

Your app is now live at: `https://<your-fqdn>`

---

## Step 9: Test Deployment

```bash
# Get the URL
APP_URL=$(az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  --output tsv)

# Test homepage
curl https://$APP_URL

# Test API with mock data
curl "https://$APP_URL/api/coverage?mock=true"

# Open in browser
open https://$APP_URL
```

---

## Step 10: Configure Custom Domain (Optional)

```bash
# Add custom domain
az containerapp hostname add \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --hostname knowledge-harvest.yourdomain.com

# Bind certificate (requires certificate in Azure)
az containerapp hostname bind \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --hostname knowledge-harvest.yourdomain.com \
  --environment $ENVIRONMENT_NAME \
  --certificate <certificate-name>
```

---

## Updating the Application

### Quick Update (Same Image)

```bash
# Rebuild and push new image
docker build -t knowledge-harvest:latest .
docker tag knowledge-harvest:latest $ACR_NAME.azurecr.io/knowledge-harvest:latest
docker push $ACR_NAME.azurecr.io/knowledge-harvest:latest

# Update container app
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --image $ACR_NAME.azurecr.io/knowledge-harvest:latest
```

### Update Environment Variables

```bash
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars \
    "AZURE_OPENAI_API_KEY=new_key" \
    "DATABASE_URL=/app/data/knowledge-harvest.db"
```

---

## Monitoring & Debugging

### View Logs

```bash
# Stream logs in real-time
az containerapp logs show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --follow

# Get recent logs
az containerapp logs show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --tail 100
```

### Check Replica Status

```bash
az containerapp replica list \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --output table
```

### View Metrics

```bash
# CPU and Memory usage
az monitor metrics list \
  --resource /subscriptions/<sub-id>/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.App/containerApps/$CONTAINER_APP_NAME \
  --metric "CpuUsage,MemoryUsage" \
  --output table
```

### SSH into Container (for debugging)

```bash
az containerapp exec \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --command /bin/sh
```

---

## Scaling Configuration

### Manual Scaling

```bash
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --min-replicas 2 \
  --max-replicas 10
```

### Auto-scaling Rules

```bash
# Scale based on HTTP requests
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --scale-rule-name http-scale \
  --scale-rule-type http \
  --scale-rule-http-concurrency 50

# Scale based on CPU
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --scale-rule-name cpu-scale \
  --scale-rule-type cpu \
  --scale-rule-metadata type=Utilization value=70
```

---

## Cost Optimization

### Development/Demo Environment

```bash
# Smaller resources, scale to zero when not in use
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --min-replicas 0 \
  --max-replicas 1 \
  --cpu 0.5 \
  --memory 1.0Gi
```

### Production Environment

```bash
# More resources, always-on
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --min-replicas 2 \
  --max-replicas 10 \
  --cpu 1.0 \
  --memory 2.0Gi
```

---

## Pricing Estimates

**Azure Container Apps:**
- First 180,000 vCPU-seconds/month: Free
- First 360,000 GiB-seconds/month: Free
- After: ~$0.000024 per vCPU-second, ~$0.000003 per GiB-second

**Example Monthly Costs:**
- **Development** (1 replica, 0.5 CPU, 1GB, 8hrs/day): ~$10-15/month
- **Production** (2-5 replicas, 1 CPU, 2GB, 24/7): ~$50-150/month

**Additional Costs:**
- Azure Container Registry: ~$5/month (Basic)
- Azure OpenAI: Pay-per-token (~$10-100/month depending on usage)
- Azure Storage (if using File Share): ~$5/month

**Total:** ~$25-200/month depending on scale

---

## Database Options

### Option 1: SQLite on File Share (Current Setup)
**Pros:** Simple, works out of the box
**Cons:** Performance limits, single writer

### Option 2: Azure Database for PostgreSQL
```bash
# Create PostgreSQL server
az postgres flexible-server create \
  --name kh-postgres \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --admin-user dbadmin \
  --admin-password "YourPassword123!" \
  --sku-name Standard_B1ms \
  --storage-size 32

# Update app to use PostgreSQL
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars "DATABASE_URL=postgresql://dbadmin:YourPassword123!@kh-postgres.postgres.database.azure.com:5432/knowledge_harvest?sslmode=require"
```

Update `lib/db/index.ts` to use `pg` instead of `better-sqlite3`.

### Option 3: Azure Cosmos DB (for global scale)
Best for multi-region deployments.

---

## CI/CD with GitHub Actions

Create `.github/workflows/azure-container-apps.yml`:

```yaml
name: Deploy to Azure Container Apps

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Login to Azure
        uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Build and push image
        run: |
          az acr build --registry ${{ secrets.ACR_NAME }} --image knowledge-harvest:${{ github.sha }} .

      - name: Deploy to Container Apps
        run: |
          az containerapp update \
            --name ${{ secrets.CONTAINER_APP_NAME }} \
            --resource-group ${{ secrets.RESOURCE_GROUP }} \
            --image ${{ secrets.ACR_NAME }}.azurecr.io/knowledge-harvest:${{ github.sha }}
```

---

## Cleanup (Delete Everything)

```bash
# Delete entire resource group (CAUTION: This deletes EVERYTHING)
az group delete --name $RESOURCE_GROUP --yes --no-wait
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs
az containerapp logs show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP

# Common issues:
# - Missing environment variables
# - Database connection errors
# - Port mismatch (ensure target-port is 3000)
```

### Image pull errors

```bash
# Verify ACR credentials
az acr credential show --name $ACR_NAME

# Update container app with correct credentials
az containerapp registry set \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --server $ACR_NAME.azurecr.io \
  --username $ACR_NAME \
  --password <password>
```

### Database connection errors

```bash
# Check DATABASE_URL environment variable
az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "properties.template.containers[0].env" -o table
```

---

## Next Steps

1. ✅ Deploy and test basic functionality
2. 📊 Set up Application Insights for monitoring
3. 🔐 Configure managed identity for Azure services
4. 📦 Migrate to Azure Database for PostgreSQL (optional)
5. 🌐 Set up custom domain and SSL
6. 🔄 Configure CI/CD with GitHub Actions
7. 📈 Set up auto-scaling rules based on metrics

---

## Support

- [Azure Container Apps Documentation](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
