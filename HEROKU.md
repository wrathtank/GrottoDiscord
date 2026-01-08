# Deploying Grotto Bot to Heroku

Complete guide to deploying the Grotto Discord verification bot on Heroku.

## Prerequisites

- A Heroku account
- A GitHub account (for GUI deploy)
- Your Discord bot token and client ID ready
- RPC endpoints for your blockchain

---

## Option 1: Deploy via Heroku GUI (Recommended)

### Step 1: Fork the Repository

1. Go to the GitHub repository
2. Click **Fork** in the top right
3. This creates a copy in your GitHub account

### Step 2: Create Heroku App

1. Go to [Heroku Dashboard](https://dashboard.heroku.com)
2. Click **New** → **Create new app**
3. Enter an app name (e.g., `my-grotto-bot`)
4. Choose a region
5. Click **Create app**

### Step 3: Connect to GitHub

1. In your new app, go to the **Deploy** tab
2. Under "Deployment method", click **GitHub**
3. Click **Connect to GitHub** and authorize if prompted
4. Search for `GrottoDiscord` (your forked repo)
5. Click **Connect**

### Step 4: Set Config Vars (Environment Variables)

1. Go to the **Settings** tab
2. Click **Reveal Config Vars**
3. Add each of these variables:

| KEY | VALUE |
|-----|-------|
| `DISCORD_TOKEN` | Your bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Your application client ID |
| `DISCORD_GUILD_ID` | Your Discord server ID (right-click server → Copy ID) |
| `RPC_URL_PRIMARY` | Your primary RPC URL (e.g., `https://mainnet.infura.io/v3/YOUR_KEY`) |
| `RPC_URL_SECONDARY` | Your backup RPC URL |
| `CHAIN_ID` | `1` for Ethereum, `137` for Polygon, etc. |
| `BOT_CONFIG` | Your role configuration JSON (see below) |

### Step 5: Set BOT_CONFIG

This is the most important variable. Copy this template and customize it:

```json
{"verification":{"enabled":true,"requireSignature":true,"refreshIntervalHours":24,"autoRevokeOnFailure":true},"roles":[{"id":"holder","name":"Token Holder","discordRoleId":"PASTE_DISCORD_ROLE_ID_HERE","description":"Verified token holders","requirements":[{"type":"erc20","contractAddress":"0xYOUR_TOKEN_CONTRACT_ADDRESS","minBalance":"1000000000000000000","symbol":"TOKEN","decimals":18}],"assignEmbed":{"title":"✅ Verified!","description":"You are now a verified token holder!","color":"#00FF00","thumbnail":"https://your-image-url.com/badge.png"}}],"messages":{"verificationStart":"Click the button below to verify your wallet.","walletConnected":"Wallet connected! Checking your holdings...","verificationSuccess":"Verification complete! Your roles have been updated.","verificationFailed":"You don't meet the requirements for any roles.","alreadyVerified":"You already have a wallet linked.","notLinked":"You don't have a wallet linked yet."}}
```

**To customize:**
1. Replace `PASTE_DISCORD_ROLE_ID_HERE` with your Discord role ID
2. Replace `0xYOUR_TOKEN_CONTRACT_ADDRESS` with your token contract
3. Change `minBalance` (in wei - 1000000000000000000 = 1 token with 18 decimals)
4. Update the embed title, description, color, and thumbnail URL

**Paste the entire JSON as the value for `BOT_CONFIG`** (all on one line, no line breaks)

### Step 6: Configure Dyno

1. Go to the **Resources** tab
2. You'll see two dyno types:
   - `web` - Turn this **OFF** (click the pencil, toggle off, confirm)
   - `worker` - Turn this **ON** (click the pencil, toggle on, confirm)

> ⚠️ **Important**: The bot is a worker, not a web app. Make sure `worker` is ON and `web` is OFF.

### Step 7: Deploy

1. Go back to the **Deploy** tab
2. Scroll down to "Manual deploy"
3. Select the `main` branch
4. Click **Deploy Branch**
5. Wait for the build to complete (1-2 minutes)

### Step 8: Verify It's Running

1. Go to the **More** button (top right) → **View logs**
2. You should see:
   ```
   [Config] Loading from BOT_CONFIG environment variable
   [Config] Loaded 1 role configuration(s)
   [Database] Initialized successfully
   [Bot] Logged in as YourBot#1234
   [Main] Bot is now running!
   ```

### Step 9: Enable Auto-Deploy (Optional)

1. In the **Deploy** tab, under "Automatic deploys"
2. Click **Enable Automatic Deploys**
3. Now when you update your GitHub repo, Heroku auto-deploys

---

## Option 2: Deploy via Heroku CLI

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

## Copy-Paste BOT_CONFIG Examples

These are ready to paste into the Heroku Config Vars. Just replace the placeholder values.

---

### The Grotto (Multi-Chain: AVAX + Grotto L1)

**Use for:** HERESY holders, Analog Distortions NFT holders, and AD stakers

```
{"verification":{"enabled":true,"requireSignature":true,"refreshIntervalHours":24,"autoRevokeOnFailure":true},"chains":{"avax":{"name":"Avalanche C-Chain","chainId":43114,"rpcPrimary":"https://api.avax.network/ext/bc/C/rpc","rpcSecondary":"https://avalanche-c-chain.publicnode.com"},"grotto":{"name":"The Grotto L1","chainId":36463,"rpcPrimary":"https://subnets.avax.network/thegrotto/mainnet/rpc","rpcSecondary":"https://subnets.avax.network/thegrotto/mainnet/rpc"}},"roles":[{"id":"heresy_holder","name":"HERESY Holder","discordRoleId":"REPLACE_HERESY_ROLE_ID","description":"Holders of HERESY token on Avalanche","color":"#E84142","requirements":[{"type":"erc20","chainId":"avax","contractAddress":"0x432d38f83a50ec77c409d086e97448794cf76dcf","minBalance":"1000000000000000000","symbol":"HERESY","decimals":18}],"assignEmbed":{"title":"🔥 HERESY Holder Verified!","description":"Your HERESY holdings have been verified!","color":"#E84142"}},{"id":"ad_holder","name":"Analog Distortions Holder","discordRoleId":"REPLACE_AD_HOLDER_ROLE_ID","description":"Holders of Analog Distortions NFTs","color":"#9945FF","requirements":[{"type":"erc721","chainId":"avax","contractAddress":"0x0a337be2ea71e3aea9c82d45b036ac6a6123b6d0","minBalance":"1","name":"Analog Distortions"}],"assignEmbed":{"title":"🖼️ Analog Distortions Holder!","description":"Your Analog Distortions NFT ownership has been verified!","color":"#9945FF"}},{"id":"ad_staker","name":"Analog Distortions Staker","discordRoleId":"REPLACE_AD_STAKER_ROLE_ID","description":"Users staking Analog Distortions NFTs","color":"#FFD700","requirements":[{"type":"staked","chainId":"avax","contractAddress":"0x51697170f78136c8d143b0013cf5b229ade70757","method":"stakers","minBalance":"1","symbol":"Staked AD","decimals":0}],"assignEmbed":{"title":"🔒 AD Staker Verified!","description":"Your staked Analog Distortions have been verified!","color":"#FFD700"}}],"customAbis":{"staking":["function stakers(address) view returns (uint256 amountStaked, uint256 conditionId, uint256 lastUpdate, uint256 unclaimedRewards)"]},"messages":{"verificationStart":"Click the button below to start the verification process.","walletConnected":"Wallet connected! Checking your holdings...","verificationSuccess":"Verification complete! Your roles have been updated.","verificationFailed":"Verification failed. You don't meet the requirements for any roles.","alreadyVerified":"You already have a wallet linked. Use /unlink to remove it first.","notLinked":"You don't have a wallet linked. Use /verify to link one."}}
```

**Replace these 3 values with your Discord Role IDs:**
- `REPLACE_HERESY_ROLE_ID` → Role for HERESY token holders
- `REPLACE_AD_HOLDER_ROLE_ID` → Role for Analog Distortions NFT holders
- `REPLACE_AD_STAKER_ROLE_ID` → Role for AD stakers

---

### ERC20 Token Holder

**Use for:** Fungible tokens (like ERC20)

```
{"verification":{"enabled":true,"requireSignature":true,"refreshIntervalHours":24,"autoRevokeOnFailure":true},"roles":[{"id":"holder","name":"Token Holder","discordRoleId":"REPLACE_WITH_ROLE_ID","description":"Verified token holders","requirements":[{"type":"erc20","contractAddress":"REPLACE_WITH_CONTRACT","minBalance":"1000000000000000000","symbol":"TOKEN","decimals":18}],"assignEmbed":{"title":"✅ Token Holder Verified!","description":"Welcome! You now have access to holder channels.","color":"#00FF00","thumbnail":"REPLACE_WITH_IMAGE_URL"}}],"messages":{"verificationStart":"Click below to verify your wallet holdings.","walletConnected":"Checking your token balance...","verificationSuccess":"Verification complete!","verificationFailed":"You don't hold enough tokens.","alreadyVerified":"You already have a wallet linked.","notLinked":"No wallet linked yet."}}
```

**Replace:**
- `REPLACE_WITH_ROLE_ID` → Your Discord role ID
- `REPLACE_WITH_CONTRACT` → Token contract address (0x...)
- `REPLACE_WITH_IMAGE_URL` → Badge image URL (or remove the thumbnail line)
- `minBalance` → Amount in wei (1000000000000000000 = 1 token with 18 decimals)

---

### NFT Collection (ERC721)

**Use for:** NFT collections, PFP projects

```
{"verification":{"enabled":true,"requireSignature":true,"refreshIntervalHours":24,"autoRevokeOnFailure":true},"roles":[{"id":"nft_holder","name":"NFT Holder","discordRoleId":"REPLACE_WITH_ROLE_ID","description":"NFT collection holders","requirements":[{"type":"erc721","contractAddress":"REPLACE_WITH_CONTRACT","minBalance":"1","name":"My NFT Collection"}],"assignEmbed":{"title":"🖼️ NFT Holder Verified!","description":"Welcome to the exclusive NFT holders club!","color":"#9945FF","thumbnail":"REPLACE_WITH_IMAGE_URL"}}],"messages":{"verificationStart":"Verify your NFT ownership below.","walletConnected":"Scanning for NFTs...","verificationSuccess":"NFT ownership confirmed!","verificationFailed":"No NFTs found in your wallet.","alreadyVerified":"Wallet already linked.","notLinked":"No wallet linked."}}
```

---

### Staked Tokens

**Use for:** Staking contracts

```
{"verification":{"enabled":true,"requireSignature":true,"refreshIntervalHours":24,"autoRevokeOnFailure":true},"roles":[{"id":"staker","name":"Staker","discordRoleId":"REPLACE_WITH_ROLE_ID","description":"Users staking tokens","requirements":[{"type":"staked","contractAddress":"REPLACE_WITH_STAKING_CONTRACT","method":"stakedBalance","minBalance":"100000000000000000000","symbol":"sTOKEN","decimals":18}],"assignEmbed":{"title":"🔒 Staker Verified!","description":"Thank you for staking! You now have staker benefits.","color":"#00FF88","thumbnail":"REPLACE_WITH_IMAGE_URL"}}],"customAbis":{"staking":["function stakedBalance(address) view returns (uint256)"]},"messages":{"verificationStart":"Verify your staked tokens.","walletConnected":"Checking staking contract...","verificationSuccess":"Staking verified!","verificationFailed":"No staked tokens found.","alreadyVerified":"Already linked.","notLinked":"Not linked."}}
```

**Note:** Change `stakedBalance` to match your staking contract's function name.

---

### ERC1155 Badge/Item

**Use for:** Multi-token standards, game items, badges

```
{"verification":{"enabled":true,"requireSignature":true,"refreshIntervalHours":24,"autoRevokeOnFailure":true},"roles":[{"id":"badge_holder","name":"Badge Holder","discordRoleId":"REPLACE_WITH_ROLE_ID","description":"Special badge holders","requirements":[{"type":"erc1155","contractAddress":"REPLACE_WITH_CONTRACT","tokenId":"1","minBalance":"1","name":"Special Badge"}],"assignEmbed":{"title":"🏅 Badge Verified!","description":"Your badge ownership has been confirmed!","color":"#FF6B6B","thumbnail":"REPLACE_WITH_IMAGE_URL"}}],"messages":{"verificationStart":"Verify your badge ownership.","walletConnected":"Checking for badges...","verificationSuccess":"Badge confirmed!","verificationFailed":"Badge not found.","alreadyVerified":"Already verified.","notLinked":"Not linked."}}
```

**Note:** Change `tokenId` to the specific token ID you want to check.

---

### Multiple Roles (Token + NFT)

**Use for:** Multiple tiers or different holder types

```
{"verification":{"enabled":true,"requireSignature":true,"refreshIntervalHours":24,"autoRevokeOnFailure":true},"roles":[{"id":"token_holder","name":"Token Holder","discordRoleId":"ROLE_ID_FOR_TOKEN","description":"Token holders","requirements":[{"type":"erc20","contractAddress":"TOKEN_CONTRACT","minBalance":"1000000000000000000","decimals":18}],"assignEmbed":{"title":"✅ Token Holder!","description":"Welcome token holder!","color":"#FFD700"}},{"id":"nft_holder","name":"NFT Holder","discordRoleId":"ROLE_ID_FOR_NFT","description":"NFT holders","requirements":[{"type":"erc721","contractAddress":"NFT_CONTRACT","minBalance":"1"}],"assignEmbed":{"title":"🖼️ NFT Holder!","description":"Welcome NFT holder!","color":"#9945FF"}},{"id":"whale","name":"Whale","discordRoleId":"ROLE_ID_FOR_WHALE","description":"Big holders","requireAll":true,"requirements":[{"type":"erc20","contractAddress":"TOKEN_CONTRACT","minBalance":"100000000000000000000000","decimals":18},{"type":"erc721","contractAddress":"NFT_CONTRACT","minBalance":"5"}],"assignEmbed":{"title":"🐋 Whale Status!","description":"You're a whale!","color":"#1E90FF"}}],"messages":{"verificationStart":"Verify holdings.","walletConnected":"Checking...","verificationSuccess":"Done!","verificationFailed":"Requirements not met.","alreadyVerified":"Already linked.","notLinked":"Not linked."}}
```

**Note:** The "whale" role uses `requireAll: true` meaning user needs BOTH 100k tokens AND 5 NFTs.

## Data Persistence with Supabase

⚠️ **Important**: Heroku's filesystem is ephemeral. Without Supabase, wallet links will be lost when the dyno restarts.

### Setting Up Supabase (Recommended)

1. **Create a Supabase Account**
   - Go to [supabase.com](https://supabase.com) and sign up
   - Create a new project

2. **Create Database Tables**
   - Go to the SQL Editor in your Supabase dashboard
   - Run this SQL to create the required tables:

```sql
-- Linked wallets table
CREATE TABLE linked_wallets (
  id SERIAL PRIMARY KEY,
  discord_id TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  last_verified TIMESTAMPTZ DEFAULT NOW(),
  signature TEXT,
  nonce TEXT
);

-- Verification sessions table
CREATE TABLE verification_sessions (
  id TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL,
  nonce TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  wallet_address TEXT
);

-- Role assignments table
CREATE TABLE role_assignments (
  id SERIAL PRIMARY KEY,
  discord_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(discord_id, role_id)
);

-- Create indexes
CREATE INDEX idx_wallets_discord ON linked_wallets(discord_id);
CREATE INDEX idx_wallets_address ON linked_wallets(wallet_address);
CREATE INDEX idx_sessions_discord ON verification_sessions(discord_id);
CREATE INDEX idx_roles_discord ON role_assignments(discord_id);
```

3. **Get Your Credentials**
   - Go to Project Settings → API
   - Copy the **Project URL** → This is `SUPABASE_URL`
   - Copy the **anon public** key → This is `SUPABASE_KEY`

4. **Add to Heroku Config Vars**
   - In Heroku Settings → Config Vars, add:
     - `SUPABASE_URL` = your project URL
     - `SUPABASE_KEY` = your anon key

### Without Supabase

If you don't set up Supabase, the bot will use local SQLite storage. This means:
- Wallet links will be lost when dyno restarts (daily on Heroku)
- Users will need to re-verify occasionally
- Suitable for small communities or testing

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

**Via GUI:**
1. Go to **Resources** tab → Ensure `worker` is ON
2. Go to **More** → **View logs** to see errors
3. Go to **Settings** → **Reveal Config Vars** → Check all variables are set

**Via CLI:**
```bash
heroku logs --tail
heroku ps:scale worker=1
heroku config
```

### "Application Error" or crashes

1. **Invalid BOT_CONFIG JSON** - Most common issue!
   - Validate your JSON at [jsonlint.com](https://jsonlint.com)
   - Make sure it's all on ONE line with no line breaks
   - Check for missing commas or quotes

2. **Wrong Discord token**
   - Go to Discord Developer Portal → Bot → Reset Token → Copy new one
   - Update in Heroku Config Vars

3. **RPC not accessible**
   - Test your RPC URL in browser: `https://your-rpc.com` should respond
   - Try a different RPC provider

### Commands not appearing in Discord

1. **Wait time**: Global commands take up to 1 hour to appear
2. **Quick fix**: Set `DISCORD_GUILD_ID` in Config Vars for instant guild commands
3. **Re-invite bot**: Use this URL format:
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=268435456&scope=bot%20applications.commands
   ```

### "Missing Permissions" errors

In your Discord server:
1. Go to **Server Settings** → **Roles**
2. Drag the bot's role **ABOVE** the roles it needs to assign
3. The bot can only assign roles lower than its own role

### Roles not being assigned

1. Check `discordRoleId` matches the actual role ID in Discord
2. Verify contract address is correct (check on Etherscan)
3. Check `minBalance` - remember it's in wei!
4. Look at logs: **More** → **View logs**

### How to get Discord IDs

1. Enable Developer Mode: User Settings → Advanced → Developer Mode
2. Right-click on a role/server/channel → **Copy ID**

## Updating the Bot (GUI)

1. If you enabled **Auto Deploy**: Just push to your GitHub repo
2. If manual: Go to **Deploy** tab → **Deploy Branch**

## Updating the Bot (CLI)

```bash
git pull origin main
git push heroku main
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
