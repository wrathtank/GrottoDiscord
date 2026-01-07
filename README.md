# Grotto Discord Verification Bot

A secure, plug-and-play Discord bot for verifying on-chain token and NFT holdings. Supports ERC20, ERC721, ERC1155, ERC404 tokens, and staked positions with automatic role assignment.

## Features

- **Multi-Token Support**: ERC20, ERC721, ERC1155, ERC404, and custom staking contracts
- **Dual RPC Failover**: Automatic fallback to secondary RPC if primary fails
- **Secure Wallet Linking**: Signature-based wallet verification
- **Automatic Role Management**: Assign/revoke roles based on holdings
- **Custom Embeds & Images**: Rich embeds with thumbnails when roles are assigned
- **Admin Dashboard**: Stats, health checks, and bulk refresh capabilities
- **Persistent Storage**: SQLite database for wallet links and sessions

## Quick Start

### 1. Prerequisites

- Node.js 18+
- A Discord bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- RPC endpoints for your target blockchain

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/your-org/GrottoDiscord.git
cd GrottoDiscord

# Install dependencies
npm install

# Copy configuration files
cp .env.example .env
cp config/config.example.json config/config.json
```

### 3. Configuration

#### Environment Variables (`.env`)

```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_client_id_here
DISCORD_GUILD_ID=your_discord_guild_id_here  # Optional: for guild-specific commands

# RPC Endpoints (primary and fallback)
RPC_URL_PRIMARY=https://your-primary-rpc.com
RPC_URL_SECONDARY=https://your-backup-rpc.com

# Chain ID (default: 1 for Ethereum mainnet)
CHAIN_ID=1

# Verification Settings
VERIFICATION_EXPIRY_MINUTES=10
```

#### Role Configuration (`config/config.json`)

See `config/config.example.json` for a complete example. Key sections:

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
      "id": "unique_role_id",
      "name": "Display Name",
      "discordRoleId": "123456789012345678",
      "requirements": [
        {
          "type": "erc20",
          "contractAddress": "0x...",
          "minBalance": "1000000000000000000",
          "decimals": 18
        }
      ],
      "assignEmbed": {
        "title": "Role Assigned!",
        "description": "Welcome!",
        "thumbnail": "https://your-image-url.com/image.png"
      }
    }
  ]
}
```

### 4. Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to "Bot" section and create a bot
4. Copy the token to your `.env` file
5. Enable these **Privileged Gateway Intents**:
   - Server Members Intent
6. Go to OAuth2 → URL Generator
7. Select scopes: `bot`, `applications.commands`
8. Select permissions: `Manage Roles`, `Send Messages`, `Use Slash Commands`
9. Use the generated URL to invite the bot to your server

### 5. Run the Bot

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Commands

### User Commands

| Command | Description |
|---------|-------------|
| `/verify` | Link and verify your wallet |
| `/refresh` | Re-check your holdings and update roles |
| `/unlink` | Remove your linked wallet |
| `/status` | View your current holdings and eligible roles |

### Admin Commands (Requires Administrator)

| Command | Description |
|---------|-------------|
| `/admin stats` | View bot statistics |
| `/admin health` | Check RPC endpoint status |
| `/admin lookup @user` | Look up a user's linked wallet |
| `/admin forceunlink @user` | Force unlink a user's wallet |
| `/admin refreshall` | Refresh all linked wallets |
| `/admin cleanup` | Clean expired verification sessions |
| `/admin roles` | List all configured roles |

## Token Types

### ERC20 (Fungible Tokens)
```json
{
  "type": "erc20",
  "contractAddress": "0x...",
  "minBalance": "1000000000000000000",
  "symbol": "TOKEN",
  "decimals": 18
}
```

### ERC721 (NFTs)
```json
{
  "type": "erc721",
  "contractAddress": "0x...",
  "minBalance": "1",
  "name": "My NFT Collection"
}
```

### ERC1155 (Multi-Token)
```json
{
  "type": "erc1155",
  "contractAddress": "0x...",
  "tokenId": "1",
  "minBalance": "1",
  "name": "Badge #1"
}
```

### ERC404 (Hybrid Token)
```json
{
  "type": "erc404",
  "contractAddress": "0x...",
  "minBalance": "1000000000000000000",
  "symbol": "HYBRID",
  "decimals": 18
}
```

### Staked Tokens
```json
{
  "type": "staked",
  "contractAddress": "0x...",
  "method": "stakedBalance",
  "minBalance": "100000000000000000000",
  "symbol": "sTOKEN",
  "decimals": 18
}
```

For custom staking contracts, add the ABI to `customAbis`:
```json
{
  "customAbis": {
    "staking": [
      "function stakedBalance(address) view returns (uint256)",
      "function getStakedAmount(address) view returns (uint256)"
    ]
  }
}
```

## Role Assignment Embeds

Customize the message shown when a role is assigned:

```json
{
  "assignEmbed": {
    "title": "🎉 Welcome to the Club!",
    "description": "You've been verified as a holder!",
    "color": "#FFD700",
    "thumbnail": "https://your-cdn.com/badge.png",
    "image": "https://your-cdn.com/banner.png",
    "fields": [
      {
        "name": "Benefits",
        "value": "• Exclusive channels\n• Early access",
        "inline": false
      }
    ],
    "footer": "Thank you for holding!"
  }
}
```

## Multiple Requirements

### Require ALL conditions (AND logic)
```json
{
  "requireAll": true,
  "requirements": [
    { "type": "erc20", "minBalance": "1000" },
    { "type": "erc721", "minBalance": "1" }
  ]
}
```

### Require ANY condition (OR logic - default)
```json
{
  "requireAll": false,
  "requirements": [
    { "type": "erc20", "minBalance": "1000" },
    { "type": "erc721", "minBalance": "1" }
  ]
}
```

## Security

- **Signature Verification**: Users must sign a message to prove wallet ownership
- **Nonce-based Sessions**: Each verification uses a unique nonce
- **Session Expiry**: Verification sessions expire after configurable time
- **One Wallet Per User**: Each Discord account can only link one wallet
- **One User Per Wallet**: Each wallet can only be linked to one Discord account
- **Admin Controls**: Force unlink and lookup capabilities for moderation

## File Structure

```
GrottoDiscord/
├── config/
│   ├── config.example.json  # Example configuration
│   └── config.json          # Your configuration (gitignored)
├── data/
│   └── grotto.db           # SQLite database (gitignored)
├── src/
│   ├── commands/           # Slash commands
│   │   ├── admin.ts
│   │   ├── refresh.ts
│   │   ├── status.ts
│   │   ├── unlink.ts
│   │   ├── verify.ts
│   │   └── index.ts
│   ├── database/           # Database operations
│   │   └── index.ts
│   ├── services/           # Business logic
│   │   └── blockchain.ts
│   ├── types/              # TypeScript types
│   │   └── index.ts
│   ├── bot.ts              # Discord bot class
│   └── index.ts            # Entry point
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### Bot not responding to commands
1. Ensure the bot has `applications.commands` scope
2. Check that commands are registered (restart the bot)
3. Verify the bot has proper permissions in the channel

### RPC errors
1. Check both RPC URLs are valid and accessible
2. Verify the chain ID matches your RPC endpoints
3. Use `/admin health` to check RPC status

### Roles not being assigned
1. Ensure the bot's role is **higher** than the roles it needs to assign
2. Verify Discord role IDs in config match actual role IDs
3. Check the contract addresses and minimum balances

### Signature verification failing
1. Ensure users are signing the exact message shown
2. Check that the wallet address matches the signing wallet
3. Verify the signature format (should start with 0x)

## License

MIT
