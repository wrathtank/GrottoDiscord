# Deploying Grotto Bot to Heroku

Complete guide to deploying the Grotto Discord verification bot on Heroku.

## Prerequisites

- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed
- A Heroku account (free tier works)
- Git installed
- Your Discord bot token and client ID ready
- RPC endpoints for your blockchain

## Quick Deploy (5 minutes)

### Step 1: Clone and Setup

```bash
# Clone the repository
git clone https://github.com/your-org/GrottoDiscord.git
cd GrottoDiscord

# Login to Heroku
heroku login
```

### Step 2: Create Heroku App

```bash
# Create a new Heroku app
heroku create your-bot-name

# Or connect to existing app
heroku git:remote -a your-existing-app-name
```

### Step 3: Set Environment Variables

```bash
# Required variables
heroku config:set DISCORD_TOKEN="your_discord_bot_token"
heroku config:set DISCORD_CLIENT_ID="your_discord_client_id"
heroku config:set RPC_URL_PRIMARY="https://your-primary-rpc.com"
heroku config:set RPC_URL_SECONDARY="https://your-backup-rpc.com"

# Optional variables
heroku config:set DISCORD_GUILD_ID="your_guild_id"  # For guild-specific commands
heroku config:set CHAIN_ID="1"  # Default: 1 (Ethereum mainnet)
heroku config:set VERIFICATION_EXPIRY_MINUTES="10"
```

### Step 4: Set Bot Configuration

Create your configuration JSON and set it as an environment variable:

```bash
# Option A: Set directly (escape quotes properly)
heroku config:set BOT_CONFIG='{"verification":{"enabled":true,"requireSignature":true,"refreshIntervalHours":24,"autoRevokeOnFailure":true},"roles":[{"id":"holder","name":"Token Holder","discordRoleId":"YOUR_ROLE_ID","description":"Token holders","requirements":[{"type":"erc20","contractAddress":"0xYOUR_TOKEN_ADDRESS","minBalance":"1000000000000000000","decimals":18}],"assignEmbed":{"title":"Welcome!","description":"You are now a verified holder!","color":"#FFD700"}}],"messages":{"verificationStart":"Click below to verify your wallet.","walletConnected":"Checking holdings...","verificationSuccess":"Verification complete!","verificationFailed":"You dont meet requirements.","alreadyVerified":"Wallet already linked.","notLinked":"No wallet linked."}}'

# Option B: Set from a file (recommended for complex configs)
heroku config:set BOT_CONFIG="$(cat config/config.json | tr -d '\n')"
```

### Step 5: Deploy

```bash
# Deploy to Heroku
git push heroku main

# Scale the worker dyno (bots use worker, not web)
heroku ps:scale worker=1
```

### Step 6: Verify Deployment

```bash
# Check logs
heroku logs --tail

# You should see:
# [Config] Loading from BOT_CONFIG environment variable
# [Database] Initialized successfully
# [Bot] Logged in as YourBot#1234
```

## Configuration Reference

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Yes | Application client ID |
| `DISCORD_GUILD_ID` | No | Server ID for guild-specific commands |
| `RPC_URL_PRIMARY` | Yes | Primary blockchain RPC endpoint |
| `RPC_URL_SECONDARY` | Yes | Fallback RPC endpoint |
| `CHAIN_ID` | No | Blockchain chain ID (default: 1) |
| `BOT_CONFIG` | Yes | JSON string of role configuration |
| `VERIFICATION_EXPIRY_MINUTES` | No | Session timeout (default: 10) |

### BOT_CONFIG Structure

```json
{
  "verification": {
    "enabled": true,
    "requireSignature": true,
    "refreshIntervalHours": 24,
    "autoRevokeOnFailure": true
  },
  "roles": [
    {
      "id": "unique_id",
      "name": "Display Name",
      "discordRoleId": "DISCORD_ROLE_ID",
      "description": "Role description",
      "requirements": [
        {
          "type": "erc20|erc721|erc1155|erc404|staked",
          "contractAddress": "0x...",
          "minBalance": "1000000000000000000",
          "decimals": 18
        }
      ],
      "assignEmbed": {
        "title": "Role Assigned!",
        "description": "Welcome message",
        "color": "#FFD700",
        "thumbnail": "https://image-url.com/image.png"
      }
    }
  ],
  "messages": {
    "verificationStart": "Click to verify",
    "walletConnected": "Checking...",
    "verificationSuccess": "Done!",
    "verificationFailed": "Failed",
    "alreadyVerified": "Already linked",
    "notLinked": "Not linked"
  }
}
```

## Example Configurations

### Single ERC20 Token Role

```bash
heroku config:set BOT_CONFIG='{
  "verification": {"enabled": true, "requireSignature": true, "refreshIntervalHours": 24, "autoRevokeOnFailure": true},
  "roles": [{
    "id": "holder",
    "name": "Token Holder",
    "discordRoleId": "1234567890123456789",
    "description": "Hold 100+ tokens",
    "requirements": [{"type": "erc20", "contractAddress": "0x...", "minBalance": "100000000000000000000", "decimals": 18}],
    "assignEmbed": {"title": "Verified!", "description": "Welcome holder!", "color": "#00FF00"}
  }],
  "messages": {"verificationStart": "Verify wallet", "walletConnected": "Checking...", "verificationSuccess": "Done!", "verificationFailed": "Not enough tokens", "alreadyVerified": "Already verified", "notLinked": "Not linked"}
}'
```

### NFT Collection Role

```bash
heroku config:set BOT_CONFIG='{
  "verification": {"enabled": true, "requireSignature": true, "refreshIntervalHours": 24, "autoRevokeOnFailure": true},
  "roles": [{
    "id": "nft_holder",
    "name": "NFT Holder",
    "discordRoleId": "1234567890123456789",
    "description": "Own at least 1 NFT",
    "requirements": [{"type": "erc721", "contractAddress": "0x...", "minBalance": "1", "name": "My NFT"}],
    "assignEmbed": {"title": "NFT Verified!", "description": "Welcome to the club!", "color": "#9945FF", "thumbnail": "https://your-nft-image.com/badge.png"}
  }],
  "messages": {"verificationStart": "Verify NFT ownership", "walletConnected": "Checking blockchain...", "verificationSuccess": "NFT verified!", "verificationFailed": "No NFT found", "alreadyVerified": "Already verified", "notLinked": "No wallet linked"}
}'
```

## Data Persistence

⚠️ **Important**: Heroku's filesystem is ephemeral. The SQLite database will be lost when:
- Dyno restarts (happens daily)
- You deploy new code
- Dyno sleeps and wakes up (free tier)

### Solutions:

1. **Heroku Postgres (Recommended for production)**
   - Coming soon: Full PostgreSQL support
   - For now, users will need to re-verify after restarts

2. **Accept Ephemeral Storage**
   - Suitable for small communities
   - Users re-verify occasionally
   - No additional cost

3. **External Database**
   - Set `DATABASE_PATH` to a persistent volume
   - Requires additional addon

## Useful Commands

```bash
# View logs
heroku logs --tail

# Restart the bot
heroku ps:restart worker

# Check dyno status
heroku ps

# View config vars
heroku config

# Open Heroku dashboard
heroku open

# Run one-off command
heroku run npm run build
```

## Troubleshooting

### Bot not starting

```bash
# Check logs for errors
heroku logs --tail

# Ensure worker is scaled
heroku ps:scale worker=1

# Verify environment variables
heroku config
```

### "Application Error" or crashes

1. Check `BOT_CONFIG` is valid JSON:
   ```bash
   # Test your JSON locally first
   node -e "JSON.parse(process.env.BOT_CONFIG)"
   ```

2. Verify Discord token is correct

3. Check RPC endpoints are accessible

### Commands not appearing

1. Wait 1 hour for global commands to propagate
2. Or set `DISCORD_GUILD_ID` for instant guild commands
3. Re-invite bot with `applications.commands` scope

### "Missing Permissions" errors

Ensure bot role is **above** the roles it needs to assign in Discord server settings.

## Updating the Bot

```bash
# Pull latest changes
git pull origin main

# Deploy to Heroku
git push heroku main

# Watch logs during deployment
heroku logs --tail
```

## Cost Estimate

| Tier | Dynos | Cost | Notes |
|------|-------|------|-------|
| Eco | 1 worker | $5/month | Sleeps after 30 min inactive |
| Basic | 1 worker | $7/month | Always on |
| Standard | 1 worker | $25/month | More resources |

The bot runs fine on Eco tier for most communities.

## Support

- Check the main [README.md](./README.md) for general documentation
- Open an issue on GitHub for bugs
- Join our Discord for community support
