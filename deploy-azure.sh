#!/bin/bash

# Knowledge Harvest - Azure Container Apps Deployment Script
# This script automates the deployment process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="timelyhero"
LOCATION="eastus2"
ACR_NAME="kharvest$(date +%s)"  # Add timestamp to ensure uniqueness
CONTAINER_APP_NAME="knowledge-harvest"
ENVIRONMENT_NAME="kh-env"

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Knowledge Harvest - Azure Deployment Script        ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v az &> /dev/null; then
    echo -e "${RED}Error: Azure CLI is not installed${NC}"
    echo "Install with: brew install azure-cli"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Install from: https://www.docker.com/get-started"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker is not running${NC}"
    echo "Please start Docker Desktop"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"
echo

# Login to Azure
echo -e "${YELLOW}Logging in to Azure...${NC}"
az login --output none

# Set subscription (if multiple exist)
SUBSCRIPTION_COUNT=$(az account list --query "length([])" -o tsv)
if [ "$SUBSCRIPTION_COUNT" -gt 1 ]; then
    echo "Multiple subscriptions found:"
    az account list --output table
    echo
    read -p "Enter subscription name or ID: " SUBSCRIPTION
    az account set --subscription "$SUBSCRIPTION"
fi

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo -e "${GREEN}✓ Using subscription: $(az account show --query name -o tsv)${NC}"
echo

# Create resource group
echo -e "${YELLOW}Creating resource group...${NC}"
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION \
  --output none

echo -e "${GREEN}✓ Resource group created${NC}"

# Create Azure Container Registry
echo -e "${YELLOW}Creating Azure Container Registry (this may take 2-3 minutes)...${NC}"
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true \
  --output none

echo -e "${GREEN}✓ Container Registry created: $ACR_NAME${NC}"

# Login to ACR
echo -e "${YELLOW}Logging in to Container Registry...${NC}"
az acr login --name $ACR_NAME

# Build and push Docker image
echo -e "${YELLOW}Building Docker image (this may take 5-10 minutes)...${NC}"
docker build -t knowledge-harvest:latest .

echo -e "${YELLOW}Tagging image...${NC}"
docker tag knowledge-harvest:latest $ACR_NAME.azurecr.io/knowledge-harvest:latest

echo -e "${YELLOW}Pushing image to ACR...${NC}"
docker push $ACR_NAME.azurecr.io/knowledge-harvest:latest

echo -e "${GREEN}✓ Image pushed to registry${NC}"

# Create Container Apps environment
echo -e "${YELLOW}Creating Container Apps environment (this may take 3-5 minutes)...${NC}"
az containerapp env create \
  --name $ENVIRONMENT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --output none

echo -e "${GREEN}✓ Container Apps environment created${NC}"

# Get ACR password
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

# Read environment variables from .env.local
echo -e "${YELLOW}Loading environment variables from .env.local...${NC}"
if [ ! -f .env.local ]; then
    echo -e "${RED}Error: .env.local file not found${NC}"
    echo "Please create .env.local with your Azure credentials"
    exit 1
fi

# Source env vars (simplified - in production use a more robust method)
export $(cat .env.local | grep -v '^#' | xargs)

# Deploy container app
echo -e "${YELLOW}Deploying container app...${NC}"
az containerapp create \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_NAME.azurecr.io/knowledge-harvest:latest \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $ACR_NAME \
  --registry-password $ACR_PASSWORD \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 1.0 \
  --memory 2.0Gi \
  --env-vars \
    "AZURE_OPENAI_API_KEY=$AZURE_OPENAI_API_KEY" \
    "AZURE_OPENAI_ENDPOINT=$AZURE_OPENAI_ENDPOINT" \
    "AZURE_OPENAI_DEPLOYMENT_NAME=$AZURE_OPENAI_DEPLOYMENT_NAME" \
    "AZURE_OPENAI_REALTIME_DEPLOYMENT_NAME=$AZURE_OPENAI_REALTIME_DEPLOYMENT_NAME" \
    "AZURE_OPENAI_API_VERSION=$AZURE_OPENAI_API_VERSION" \
    "AZURE_SPEECH_KEY=$AZURE_SPEECH_KEY" \
    "AZURE_SPEECH_REGION=$AZURE_SPEECH_REGION" \
    "AZURE_STORAGE_CONNECTION_STRING=$AZURE_STORAGE_CONNECTION_STRING" \
    "AZURE_STORAGE_CONTAINER_NAME=$AZURE_STORAGE_CONTAINER_NAME" \
    "AZURE_SEARCH_ENDPOINT=$AZURE_SEARCH_ENDPOINT" \
    "AZURE_SEARCH_API_KEY=$AZURE_SEARCH_API_KEY" \
    "AZURE_SEARCH_INDEX_NAME=$AZURE_SEARCH_INDEX_NAME" \
    "DATABASE_URL=/app/data/knowledge-harvest.db" \
    "NODE_ENV=production" \
  --output none

echo -e "${GREEN}✓ Container app deployed${NC}"

# Get app URL
APP_URL=$(az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  --output tsv)

echo
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            🎉 Deployment Successful! 🎉               ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo
echo -e "${GREEN}Your application is now live at:${NC}"
echo -e "${YELLOW}https://$APP_URL${NC}"
echo
echo -e "${GREEN}Next steps:${NC}"
echo "1. Open the URL in your browser"
echo "2. Test with: curl https://$APP_URL/api/coverage?mock=true"
echo "3. Monitor logs: az containerapp logs show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --follow"
echo
echo -e "${GREEN}Resource details:${NC}"
echo "Resource Group: $RESOURCE_GROUP"
echo "Container Registry: $ACR_NAME.azurecr.io"
echo "Container App: $CONTAINER_APP_NAME"
echo "Location: $LOCATION"
echo
echo -e "${YELLOW}To update the app, run:${NC}"
echo "./update-azure.sh"
echo
echo -e "${YELLOW}To delete all resources:${NC}"
echo "az group delete --name $RESOURCE_GROUP --yes"
echo
