# The Grotto - Wallet Verification Website

Dark, glitchy wallet verification page for The Grotto Discord.

## Setup

### 1. Add Your Images

Place your skull/grotto images in the `images/` folder:
- `grotto-skull.png` - Main skull logo

### 2. Deploy to Vercel

**Option A: Via Vercel CLI**
```bash
cd web
npm i -g vercel
vercel
```

**Option B: Via Vercel Dashboard**
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repo
3. Set root directory to `web`
4. Deploy

### 3. Update Discord Bot

After deploying, update the verify command to link to your Vercel URL instead of Snowtrace.

## Features

- 🔥 Fire cursor effects
- 💀 Floating skull backgrounds
- 🩸 Blood drip animations
- 📺 Glitch text effects
- 🎮 Scanline overlay
- 🔗 MetaMask wallet connection
- ✍️ Message signing

## Customization

Edit `styles.css` to change:
- Colors (look for `--red`, `--dark-red`, `--blood` variables)
- Animation speeds
- Glitch intensity

Edit `app.js` to change:
- Message text
- Particle density
- Cursor effects
