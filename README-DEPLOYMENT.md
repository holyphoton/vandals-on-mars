# Vandals On Mars - Deployment Guide

This guide will walk you through deploying the "Vandals On Mars" game to Render.com with your custom domain.

## Prerequisites

1. A GitHub account with your repository at https://github.com/holyphoton/vandals-on-mars
2. A Render.com account
3. Your domain (vandalsonmars.com) with access to DNS settings

## Step 1: Deploy to Render

1. Log in to your Render.com account at https://dashboard.render.com/
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository (https://github.com/holyphoton/vandals-on-mars)
4. Configure the service:
   - **Name**: vandals-on-mars
   - **Environment**: Node
   - **Region**: Choose the closest to your target audience
   - **Branch**: main (or your default branch)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Select an appropriate plan (Start with Free then upgrade if needed)

5. Under "Advanced" settings:
   - Add an environment variable: `DATA_DIR` with value `/var/data`
   - Enable "Auto-Deploy" (optional)

6. Click "Create Web Service"

## Step 2: Set Up Persistent Storage

1. After your service is created, go to your web service dashboard
2. Navigate to the "Disks" tab
3. Click "Add Disk"
4. Configure the disk:
   - **Name**: game-data
   - **Mount Path**: `/var/data`
   - **Size**: 1 GB (increase later if needed)
5. Click "Save"

## Step 3: Connect Your Custom Domain

1. In your web service dashboard, navigate to the "Settings" tab
2. Scroll to the "Custom Domain" section
3. Click "Add Custom Domain"
4. Enter your domain: `vandalsonmars.com`
5. Follow Render's instructions to verify your domain (this will involve adding DNS records)
6. Also add `www.vandalsonmars.com` as an additional domain if desired

## Step 4: Configure DNS for Your Domain

1. Log in to your domain registrar or DNS provider
2. Add a CNAME record:
   - **Host**: `www` (or `@` for root domain)
   - **Value**: Your Render URL (e.g., `vandals-on-mars.onrender.com`)
   - **TTL**: 3600 (or as recommended)

3. If using the root domain (`vandalsonmars.com`), you might need to add:
   - An A record pointing to Render's IP addresses
   - An ALIAS or ANAME record (if your provider supports it)

4. Follow Render's specific instructions shown in the Custom Domain setup page

## Step 5: SSL Configuration

1. Once your DNS records propagate, Render will automatically issue an SSL certificate
2. This process can take up to 24 hours
3. Your site will use HTTPS once the certificate is issued

## Updating Your Game

When you make changes to your code:

1. Push changes to your GitHub repository
2. If auto-deploy is enabled, Render will automatically deploy the updates
3. If not, manually deploy from the Render dashboard

Your game data (billboards, players, etc.) will remain intact between deployments because it's stored on the persistent disk.

## Monitoring and Scaling

1. Render provides metrics in the "Metrics" tab to monitor performance
2. If you need more resources, you can upgrade your plan in the "Settings" tab
3. You can view logs in the "Logs" tab to troubleshoot issues

## Important Notes

- Ensure your server code is properly handling the environment variables for ports and data directories
- The free plan has limitations (falls asleep after inactivity) - consider upgrading for production use
- Always make regular backups of your game data

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Render Custom Domains](https://render.com/docs/custom-domains)
- [Node.js on Render](https://render.com/docs/deploy-node-express-app) 