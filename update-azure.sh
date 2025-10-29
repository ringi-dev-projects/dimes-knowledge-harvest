#!/bin/bash

# Knowledge Harvest - Azure Container Apps Update Script
# Updates an existing deployment with new code

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Knowledge Harvest - Deployment Update Script       ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo

# Get existing resources
echo -e "${YELLOW}Finding existing deployment...${NC}"

RESOURCE_GROUP="timelyhero"
CONTAINER_APP_NAME="knowledge-harvest"

# Find ACR name
ACR_NAME=$(az acr list --resource-group $RESOURCE_GROUP --query "[0].name" -o tsv 2>/dev/null)

if [ -z "$ACR_NAME" ]; then
    echo "Error: Container Registry not found. Have you deployed yet?"
    echo "Run ./deploy-azure.sh first"
    exit 1
fi

echo -e "${GREEN}✓ Found existing deployment${NC}"
echo "Resource Group: $RESOURCE_GROUP"
echo "Registry: $ACR_NAME"
echo

# Login to ACR
echo -e "${YELLOW}Logging in to Container Registry...${NC}"
az acr login --name $ACR_NAME

# Build new image
echo -e "${YELLOW}Building updated Docker image...${NC}"
docker build -t knowledge-harvest:latest .

# Tag with timestamp for versioning
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
echo -e "${YELLOW}Tagging image as: latest and $TIMESTAMP${NC}"
docker tag knowledge-harvest:latest $ACR_NAME.azurecr.io/knowledge-harvest:latest
docker tag knowledge-harvest:latest $ACR_NAME.azurecr.io/knowledge-harvest:$TIMESTAMP

# Push to ACR
echo -e "${YELLOW}Pushing updated image...${NC}"
docker push $ACR_NAME.azurecr.io/knowledge-harvest:latest
docker push $ACR_NAME.azurecr.io/knowledge-harvest:$TIMESTAMP

echo -e "${GREEN}✓ Image pushed${NC}"

# Update container app
echo -e "${YELLOW}Updating container app...${NC}"
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --image $ACR_NAME.azurecr.io/knowledge-harvest:latest \
  --output none

echo -e "${GREEN}✓ Container app updated${NC}"

# Get app URL
APP_URL=$(az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  --output tsv)

echo
echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            ✨ Update Successful! ✨                   ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
echo
echo -e "${GREEN}Your application has been updated:${NC}"
echo -e "${YELLOW}https://$APP_URL${NC}"
echo
echo -e "${YELLOW}The update will take 1-2 minutes to roll out.${NC}"
echo
echo "Monitor deployment:"
echo "az containerapp logs show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --follow"
echo
echo "Check revision status:"
echo "az containerapp revision list --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --output table"
echo
