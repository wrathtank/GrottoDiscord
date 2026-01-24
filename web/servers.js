// Grotto Servers - Dedicated Game Hosting

const GROTTO_CHAIN_ID = 36463;
const GROTTO_RPC = 'https://rpc.grotto.network';
const HERESY_TOKEN = '0xfa99b368b5fc1f5a061bc393dff73be8a097667d';

// ⚠️ SET YOUR TREASURY WALLET ADDRESS HERE
const TREASURY = '0x000000000000000000000000000000000000dEaD'; // <-- YOUR WALLET

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://grotto-discord-bot-7dcd8c6451fc.herokuapp.com';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)'
];

// Pricing: ~$12.50/month at $2500/HERESY = 0.005 HERESY
const PRICE_PER_MONTH = 0.005;
const DISCOUNTS = { 1: 0, 3: 0.10, 6: 0.15 };

let provider, signer, walletAddress, heresyContract;

// DOM
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// Wallet
async function connectWallet() {
  try {
    const eth = window.avalanche || window.ethereum;
    if (!eth) return alert('Install MetaMask or Core Wallet');

    const accounts = await eth.request({ method: 'eth_requestAccounts' });
    walletAddress = accounts[0];

    provider = new ethers.providers.Web3Provider(eth);
    signer = provider.getSigner();

    // Switch to Grotto if needed
    const network = await provider.getNetwork();
    if (network.chainId !== GROTTO_CHAIN_ID) {
      try {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + GROTTO_CHAIN_ID.toString(16) }]
        });
      } catch (e) {
        if (e.code === 4902) {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x' + GROTTO_CHAIN_ID.toString(16),
              chainName: 'The Grotto L1',
              nativeCurrency: { name: 'HERESY', symbol: 'HERESY', decimals: 18 },
              rpcUrls: [GROTTO_RPC]
            }]
          });
        }
      }
      provider = new ethers.providers.Web3Provider(eth);
      signer = provider.getSigner();
    }

    heresyContract = new ethers.Contract(HERESY_TOKEN, ERC20_ABI, signer);
    await updateBalance();

    $('wallet-address').textContent = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
    $('wallet-disconnected').classList.add('hidden');
    $('wallet-connected').classList.remove('hidden');

    eth.on('accountsChanged', accounts => {
      if (accounts.length === 0) disconnectWallet();
      else { walletAddress = accounts[0]; updateBalance(); loadMyServers(); }
    });

    loadMyServers();
  } catch (e) {
    console.error(e);
    alert('Failed to connect wallet');
  }
}

function disconnectWallet() {
  provider = signer = walletAddress = heresyContract = null;
  $('wallet-connected').classList.add('hidden');
  $('wallet-disconnected').classList.remove('hidden');
  $('my-servers-list').innerHTML = '<p class="empty-state">Connect wallet to view your servers</p>';
}

async function updateBalance() {
  if (!heresyContract || !walletAddress) return;
  try {
    const bal = await heresyContract.balanceOf(walletAddress);
    $('heresy-balance').textContent = parseFloat(ethers.utils.formatEther(bal)).toFixed(2) + ' HERESY';
  } catch (e) {
    $('heresy-balance').textContent = '-- HERESY';
  }
}

// Tabs
function switchTab(tab) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $$('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === 'tab-' + tab);
    c.classList.toggle('hidden', c.id !== 'tab-' + tab);
  });
}

// Servers
async function loadServers() {
  $('servers-list').innerHTML = '<div class="loading">Loading...</div>';
  try {
    const res = await fetch(API_URL + '/api/servers');
    const data = await res.json();

    if (!data.success || !data.servers.length) {
      $('servers-list').innerHTML = '<p class="empty-state">No active servers</p>';
      return;
    }

    $('servers-list').innerHTML = data.servers.map(s => `
      <div class="server-card" onclick="showServer('${s.id}')">
        <div class="server-top">
          <span class="server-name">${esc(s.name)}</span>
          <span class="status ${s.status}">${s.status}</span>
        </div>
        <div class="server-game">${esc(s.gameName)}</div>
        <div class="server-players">${s.currentPlayers}/${s.maxPlayers} players</div>
        <code class="server-addr">${s.address || 'Provisioning...'}:${s.port}</code>
      </div>
    `).join('');
  } catch (e) {
    $('servers-list').innerHTML = '<p class="empty-state">Failed to load servers</p>';
  }
}

async function loadMyServers() {
  if (!walletAddress) return;
  $('my-servers-list').innerHTML = '<div class="loading">Loading...</div>';
  try {
    const res = await fetch(API_URL + '/api/servers/my?wallet=' + walletAddress);
    const data = await res.json();

    if (!data.success || !data.servers.length) {
      $('my-servers-list').innerHTML = '<p class="empty-state">No servers yet. <a href="#" onclick="switchTab(\'rent\')">Rent one!</a></p>';
      return;
    }

    $('my-servers-list').innerHTML = data.servers.map(s => `
      <div class="server-card my-server">
        <div class="server-top">
          <span class="server-name">${esc(s.name)}</span>
          <span class="status ${s.status}">${s.status}</span>
        </div>
        <div class="server-game">${esc(s.gameName)}</div>
        <div class="server-meta">
          <span>${s.currentPlayers}/${s.maxPlayers} players</span>
          <span>Expires: ${formatDate(s.expiresAt)}</span>
        </div>
        <code class="server-addr">${s.address}:${s.port}</code>
      </div>
    `).join('');
  } catch (e) {
    $('my-servers-list').innerHTML = '<p class="empty-state">Failed to load</p>';
  }
}

function showServer(id) {
  // TODO: Fetch and show server details modal
}

// Rent
async function rentServer() {
  if (!walletAddress) return alert('Connect wallet first');

  const name = $('server-name').value.trim();
  const game = $('game-name').value.trim();
  const password = $('server-password').value;
  const duration = parseInt($('rental-duration').value);

  if (!name) return alert('Enter server name');
  if (!game) return alert('Enter game name');

  const discount = DISCOUNTS[duration] || 0;
  const total = PRICE_PER_MONTH * duration * (1 - discount);

  // Check balance
  const bal = await heresyContract.balanceOf(walletAddress);
  if (parseFloat(ethers.utils.formatEther(bal)) < total) {
    return alert('Insufficient HERESY. Need ' + total);
  }

  // Show payment modal
  $('payment-modal').classList.remove('hidden');
  $('payment-message').textContent = 'Confirm transaction in wallet...';

  try {
    const amount = ethers.utils.parseEther(total.toString());
    const tx = await heresyContract.transfer(TREASURY, amount);

    $('payment-message').textContent = 'Processing transaction...';
    await tx.wait();

    $('payment-message').textContent = 'Creating server...';

    // Register with API
    const res = await fetch(API_URL + '/api/servers/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, gameName: game, password: password || null,
        tier: 'standard', duration, ownerWallet: walletAddress, txHash: tx.hash
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    $('payment-message').textContent = 'Server created! Provisioning...';

    setTimeout(() => {
      $('payment-modal').classList.add('hidden');
      $('server-name').value = '';
      $('game-name').value = '';
      $('server-password').value = '';
      switchTab('my-servers');
      loadMyServers();
      updateBalance();
    }, 2000);

  } catch (e) {
    console.error(e);
    $('payment-message').textContent = 'Error: ' + (e.message || 'Transaction failed');
    setTimeout(() => $('payment-modal').classList.add('hidden'), 3000);
  }
}

// Helpers
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Events
$('btn-connect-wallet').onclick = connectWallet;
$('btn-disconnect').onclick = disconnectWallet;
$('btn-refresh').onclick = loadServers;
$('btn-rent').onclick = rentServer;

$$('.tab').forEach(t => t.onclick = () => switchTab(t.dataset.tab));
$$('.modal-bg, .modal-close').forEach(el => el.onclick = () => {
  $('server-modal').classList.add('hidden');
});

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadServers();
});
