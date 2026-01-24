// The Grotto - Game Server Rental System
// Grotto Mainnet HERESY Payment Integration

// ============================================
// CONFIGURATION
// ============================================

const GROTTO_CHAIN_ID = 36463;
const GROTTO_RPC = 'https://rpc.grotto.network';

// Contract addresses on Grotto mainnet
const HERESY_TOKEN_ADDRESS = '0xfa99b368b5fc1f5a061bc393dff73be8a097667d'; // wHERESY on Grotto
const SERVER_RENTAL_CONTRACT = '0x0000000000000000000000000000000000000000'; // To be deployed

// API endpoint (same as verification API)
const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://grotto-discord-bot-7dcd8c6451fc.herokuapp.com';

// ERC20 ABI for HERESY token
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)'
];

// Pricing tiers (in HERESY tokens - 18 decimals)
const PRICING_TIERS = {
  basic: {
    name: 'Basic',
    price: 100,
    players: 10,
    cpu: 1,
    ram: 1
  },
  standard: {
    name: 'Standard',
    price: 250,
    players: 25,
    cpu: 2,
    ram: 2
  },
  premium: {
    name: 'Premium',
    price: 500,
    players: 50,
    cpu: 4,
    ram: 4
  }
};

// Duration discounts
const DURATION_DISCOUNTS = {
  1: 0,
  3: 0.10,
  6: 0.15,
  12: 0.20
};

// ============================================
// STATE
// ============================================

let provider = null;
let signer = null;
let walletAddress = null;
let heresyBalance = '0';
let selectedTier = null;
let heresyContract = null;

// Mock server data for demo (will be replaced by API calls)
let mockServers = [
  {
    id: 'srv-001',
    name: 'Grotto Arena #1',
    game: 'Grotto Arena',
    owner: '0x1234...5678',
    players: { current: 8, max: 25 },
    status: 'online',
    tier: 'standard',
    address: 'srv-001.grotto.gg',
    port: 7777,
    hasPassword: false
  },
  {
    id: 'srv-002',
    name: 'Dungeon Crawlers',
    game: 'Dungeon Master',
    owner: '0xabcd...efgh',
    players: { current: 3, max: 10 },
    status: 'online',
    tier: 'basic',
    address: 'srv-002.grotto.gg',
    port: 7777,
    hasPassword: true
  },
  {
    id: 'srv-003',
    name: 'Battle Royale Pro',
    game: 'Grotto Royale',
    owner: '0x9876...5432',
    players: { current: 45, max: 50 },
    status: 'online',
    tier: 'premium',
    address: 'srv-003.grotto.gg',
    port: 7777,
    hasPassword: false
  }
];

// ============================================
// DOM ELEMENTS
// ============================================

const walletSection = document.getElementById('wallet-section');
const walletDisconnected = document.getElementById('wallet-disconnected');
const walletConnected = document.getElementById('wallet-connected');
const walletAddressEl = document.getElementById('wallet-address');
const heresyBalanceEl = document.getElementById('heresy-balance');
const btnConnectWallet = document.getElementById('btn-connect-wallet');
const btnDisconnect = document.getElementById('btn-disconnect');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

const serversList = document.getElementById('servers-list');
const myServersList = document.getElementById('my-servers-list');

const serverConfigForm = document.getElementById('server-config-form');
const btnCancelRent = document.getElementById('btn-cancel-rent');
const btnConfirmRent = document.getElementById('btn-confirm-rent');
const rentalDurationSelect = document.getElementById('rental-duration');

const serverModal = document.getElementById('server-modal');
const paymentModal = document.getElementById('payment-modal');

// ============================================
// WALLET CONNECTION
// ============================================

async function connectWallet() {
  try {
    btnConnectWallet.innerHTML = '<span>CONNECTING...</span>';

    // Get the best available provider
    const ethereumProvider = window.avalanche || window.ethereum || window.web3?.currentProvider;

    if (!ethereumProvider) {
      showNotification('No wallet detected! Please install MetaMask or Core Wallet.', 'error');
      btnConnectWallet.innerHTML = '<span>CONNECT WALLET</span>';
      return;
    }

    // Request accounts
    const accounts = await ethereumProvider.request({ method: 'eth_requestAccounts' });

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned');
    }

    walletAddress = accounts[0];

    // Create provider and signer
    provider = new ethers.providers.Web3Provider(ethereumProvider);
    signer = provider.getSigner();

    // Check if we're on Grotto network
    const network = await provider.getNetwork();
    if (network.chainId !== GROTTO_CHAIN_ID) {
      // Try to switch to Grotto network
      try {
        await ethereumProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + GROTTO_CHAIN_ID.toString(16) }],
        });
        // Re-init provider after network switch
        provider = new ethers.providers.Web3Provider(ethereumProvider);
        signer = provider.getSigner();
      } catch (switchError) {
        // Network doesn't exist, try to add it
        if (switchError.code === 4902) {
          try {
            await ethereumProvider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x' + GROTTO_CHAIN_ID.toString(16),
                chainName: 'The Grotto L1',
                nativeCurrency: {
                  name: 'HERESY',
                  symbol: 'HERESY',
                  decimals: 18
                },
                rpcUrls: [GROTTO_RPC],
                blockExplorerUrls: ['https://explorer.grotto.network']
              }],
            });
            provider = new ethers.providers.Web3Provider(ethereumProvider);
            signer = provider.getSigner();
          } catch (addError) {
            console.error('Failed to add Grotto network:', addError);
            showNotification('Please add The Grotto network manually.', 'error');
          }
        } else {
          console.error('Failed to switch network:', switchError);
        }
      }
    }

    // Initialize HERESY contract
    heresyContract = new ethers.Contract(HERESY_TOKEN_ADDRESS, ERC20_ABI, signer);

    // Get HERESY balance
    await updateHeresyBalance();

    // Update UI
    walletAddressEl.textContent = formatAddress(walletAddress);
    walletDisconnected.classList.add('hidden');
    walletConnected.classList.remove('hidden');

    // Set up account change listener
    ethereumProvider.on('accountsChanged', handleAccountsChanged);
    ethereumProvider.on('chainChanged', handleChainChanged);

    showNotification('Wallet connected successfully!', 'success');

    // Load user's servers
    loadMyServers();

  } catch (error) {
    console.error('Connection error:', error);
    btnConnectWallet.innerHTML = '<span>CONNECT WALLET</span>';

    if (error.code === 4001) {
      showNotification('Connection rejected. Please approve the connection.', 'error');
    } else {
      showNotification('Failed to connect wallet. Please try again.', 'error');
    }
  }
}

function disconnectWallet() {
  provider = null;
  signer = null;
  walletAddress = null;
  heresyBalance = '0';
  heresyContract = null;

  walletConnected.classList.add('hidden');
  walletDisconnected.classList.remove('hidden');
  btnConnectWallet.innerHTML = '<span>CONNECT WALLET</span>';

  showNotification('Wallet disconnected.', 'info');
}

function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    disconnectWallet();
  } else if (accounts[0] !== walletAddress) {
    walletAddress = accounts[0];
    walletAddressEl.textContent = formatAddress(walletAddress);
    updateHeresyBalance();
    loadMyServers();
  }
}

function handleChainChanged() {
  window.location.reload();
}

async function updateHeresyBalance() {
  if (!heresyContract || !walletAddress) return;

  try {
    const balance = await heresyContract.balanceOf(walletAddress);
    heresyBalance = ethers.utils.formatEther(balance);
    heresyBalanceEl.textContent = `${parseFloat(heresyBalance).toFixed(2)} HERESY`;
  } catch (error) {
    console.error('Failed to get HERESY balance:', error);
    heresyBalanceEl.textContent = '-- HERESY';
  }
}

// ============================================
// TAB NAVIGATION
// ============================================

function switchTab(tabId) {
  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  tabContents.forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabId}`);
    content.classList.toggle('hidden', content.id !== `tab-${tabId}`);
  });
}

// ============================================
// SERVER LISTING
// ============================================

async function loadServers() {
  serversList.innerHTML = `
    <div class="loading-servers">
      <div class="loading-spinner"></div>
      <p>Loading servers...</p>
    </div>
  `;

  try {
    // In production, this would be an API call
    // const response = await fetch(`${API_BASE_URL}/api/servers`);
    // const servers = await response.json();

    // For now, use mock data
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    const servers = mockServers;

    if (servers.length === 0) {
      serversList.innerHTML = `
        <div class="no-servers">
          <p>No servers available at the moment.</p>
        </div>
      `;
      return;
    }

    serversList.innerHTML = servers.map(server => createServerCard(server)).join('');

    // Add click listeners to server cards
    document.querySelectorAll('.server-card').forEach(card => {
      card.addEventListener('click', () => showServerDetails(card.dataset.serverId));
    });

  } catch (error) {
    console.error('Failed to load servers:', error);
    serversList.innerHTML = `
      <div class="error-message">
        <p>Failed to load servers. Please try again.</p>
        <button class="btn-secondary" onclick="loadServers()">RETRY</button>
      </div>
    `;
  }
}

function createServerCard(server) {
  const statusClass = server.status === 'online' ? 'status-online' : 'status-offline';
  const playerPercent = (server.players.current / server.players.max) * 100;

  return `
    <div class="server-card" data-server-id="${server.id}">
      <div class="server-header">
        <span class="server-name">${escapeHtml(server.name)}</span>
        <span class="server-status ${statusClass}">${server.status.toUpperCase()}</span>
      </div>
      <div class="server-game">${escapeHtml(server.game)}</div>
      <div class="server-players">
        <div class="players-bar">
          <div class="players-fill" style="width: ${playerPercent}%"></div>
        </div>
        <span>${server.players.current}/${server.players.max} players</span>
      </div>
      <div class="server-meta">
        <span class="server-tier tier-${server.tier}">${server.tier.toUpperCase()}</span>
        ${server.hasPassword ? '<span class="server-locked">&#128274;</span>' : ''}
      </div>
      <div class="server-connect">
        <code>${server.address}:${server.port}</code>
      </div>
    </div>
  `;
}

function showServerDetails(serverId) {
  const server = mockServers.find(s => s.id === serverId);
  if (!server) return;

  const modalBody = document.getElementById('modal-body');
  modalBody.innerHTML = `
    <div class="server-details">
      <div class="server-details-header">
        <h2>${escapeHtml(server.name)}</h2>
        <span class="server-status ${server.status === 'online' ? 'status-online' : 'status-offline'}">${server.status.toUpperCase()}</span>
      </div>

      <div class="details-grid">
        <div class="detail-item">
          <span class="detail-label">Game</span>
          <span class="detail-value">${escapeHtml(server.game)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Players</span>
          <span class="detail-value">${server.players.current}/${server.players.max}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Tier</span>
          <span class="detail-value tier-${server.tier}">${server.tier.toUpperCase()}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Owner</span>
          <span class="detail-value">${server.owner}</span>
        </div>
      </div>

      <div class="connect-info">
        <h3>CONNECTION INFO</h3>
        <div class="connect-details">
          <div class="connect-row">
            <span>Address:</span>
            <code>${server.address}</code>
          </div>
          <div class="connect-row">
            <span>Port:</span>
            <code>${server.port}</code>
          </div>
          ${server.hasPassword ? '<p class="password-required">This server requires a password to join.</p>' : ''}
        </div>
      </div>

      <div class="unity-snippet">
        <h3>UNITY CODE</h3>
        <pre><code>NetworkManager.singleton.networkAddress = "${server.address}";
NetworkManager.singleton.GetComponent&lt;kcp2k.KcpTransport&gt;().Port = ${server.port};
NetworkManager.singleton.StartClient();</code></pre>
      </div>
    </div>
  `;

  serverModal.classList.remove('hidden');
}

// ============================================
// SERVER RENTAL
// ============================================

function selectTier(tier) {
  selectedTier = tier;

  // Highlight selected card
  document.querySelectorAll('.pricing-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.tier === tier);
  });

  // Show config form
  serverConfigForm.classList.remove('hidden');

  // Update summary
  updateOrderSummary();

  // Scroll to form
  serverConfigForm.scrollIntoView({ behavior: 'smooth' });
}

function updateOrderSummary() {
  if (!selectedTier) return;

  const tier = PRICING_TIERS[selectedTier];
  const duration = parseInt(rentalDurationSelect.value);
  const discount = DURATION_DISCOUNTS[duration];
  const basePrice = tier.price * duration;
  const discountAmount = basePrice * discount;
  const total = basePrice - discountAmount;

  document.getElementById('summary-tier').textContent = tier.name;
  document.getElementById('summary-duration').textContent = `${duration} month${duration > 1 ? 's' : ''}`;
  document.getElementById('summary-discount').textContent = discount > 0 ? `-${(discount * 100)}%` : 'None';
  document.getElementById('summary-total').textContent = `${total.toFixed(0)} HERESY`;
}

function cancelRent() {
  selectedTier = null;
  serverConfigForm.classList.add('hidden');
  document.querySelectorAll('.pricing-card').forEach(card => {
    card.classList.remove('selected');
  });
}

async function confirmRent() {
  if (!walletAddress) {
    showNotification('Please connect your wallet first.', 'error');
    return;
  }

  if (!selectedTier) {
    showNotification('Please select a server tier.', 'error');
    return;
  }

  const serverName = document.getElementById('server-name').value.trim();
  const gameName = document.getElementById('game-name').value.trim();
  const serverPassword = document.getElementById('server-password').value;
  const duration = parseInt(rentalDurationSelect.value);

  if (!serverName) {
    showNotification('Please enter a server name.', 'error');
    return;
  }

  if (!gameName) {
    showNotification('Please enter a game name.', 'error');
    return;
  }

  // Calculate total price
  const tier = PRICING_TIERS[selectedTier];
  const discount = DURATION_DISCOUNTS[duration];
  const basePrice = tier.price * duration;
  const total = basePrice - (basePrice * discount);

  // Check balance
  if (parseFloat(heresyBalance) < total) {
    showNotification(`Insufficient HERESY balance. You need ${total} HERESY.`, 'error');
    return;
  }

  // Show payment modal
  showPaymentModal();

  try {
    // Step 1: Approve HERESY spending (if using a contract)
    // For now, we'll do a direct transfer to a treasury address
    showPaymentStep('approve');

    const treasuryAddress = '0x000000000000000000000000000000000000dEaD'; // Placeholder - set your treasury address
    const amountWei = ethers.utils.parseEther(total.toString());

    // Check current allowance (if using approval flow)
    // For direct transfer, we skip approval

    // Step 2: Transfer HERESY
    showPaymentStep('transfer');

    const tx = await heresyContract.transfer(treasuryAddress, amountWei);
    console.log('Transaction sent:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt);

    // Step 3: Register server with API
    const serverData = {
      name: serverName,
      game: gameName,
      password: serverPassword || null,
      tier: selectedTier,
      duration: duration,
      owner: walletAddress,
      txHash: tx.hash
    };

    // In production, call the API
    // const response = await fetch(`${API_BASE_URL}/api/servers/create`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(serverData)
    // });

    // For demo, add to mock data
    const newServer = {
      id: 'srv-' + Math.random().toString(36).substr(2, 9),
      name: serverName,
      game: gameName,
      owner: formatAddress(walletAddress),
      players: { current: 0, max: tier.players },
      status: 'provisioning',
      tier: selectedTier,
      address: `pending-${Date.now()}.grotto.gg`,
      port: 7777,
      hasPassword: !!serverPassword,
      expiresAt: Date.now() + (duration * 30 * 24 * 60 * 60 * 1000)
    };
    mockServers.push(newServer);

    // Show success
    showPaymentStep('success');

    // Update balance
    await updateHeresyBalance();

    // Reset form
    cancelRent();
    document.getElementById('server-name').value = '';
    document.getElementById('game-name').value = '';
    document.getElementById('server-password').value = '';

  } catch (error) {
    console.error('Payment error:', error);
    showPaymentStep('error', error.message || 'Transaction failed. Please try again.');
  }
}

function showPaymentModal() {
  paymentModal.classList.remove('hidden');
  showPaymentStep('approve');
}

function hidePaymentModal() {
  paymentModal.classList.add('hidden');
}

function showPaymentStep(step, errorMessage = null) {
  document.querySelectorAll('.payment-step').forEach(s => s.classList.add('hidden'));

  const stepEl = document.getElementById(`payment-step-${step}`);
  if (stepEl) {
    stepEl.classList.remove('hidden');
  }

  if (step === 'error' && errorMessage) {
    document.getElementById('payment-error-message').textContent = errorMessage;
  }
}

// ============================================
// MY SERVERS
// ============================================

async function loadMyServers() {
  if (!walletAddress) {
    myServersList.innerHTML = `
      <div class="no-servers">
        <p>Connect your wallet to see your servers.</p>
      </div>
    `;
    return;
  }

  myServersList.innerHTML = `
    <div class="loading-servers">
      <div class="loading-spinner"></div>
      <p>Loading your servers...</p>
    </div>
  `;

  try {
    // In production, fetch from API
    // const response = await fetch(`${API_BASE_URL}/api/servers/my?wallet=${walletAddress}`);
    // const servers = await response.json();

    // For demo, filter mock servers by owner
    await new Promise(resolve => setTimeout(resolve, 300));
    const myServers = mockServers.filter(s =>
      s.owner.toLowerCase().includes(walletAddress.toLowerCase().slice(2, 6))
    );

    if (myServers.length === 0) {
      myServersList.innerHTML = `
        <div class="no-servers">
          <p>You don't have any rented servers yet.</p>
          <button class="btn-fire btn-rent-first" onclick="switchTab('rent')">
            <span>RENT YOUR FIRST SERVER</span>
          </button>
        </div>
      `;
      return;
    }

    myServersList.innerHTML = myServers.map(server => createMyServerCard(server)).join('');

  } catch (error) {
    console.error('Failed to load my servers:', error);
    myServersList.innerHTML = `
      <div class="error-message">
        <p>Failed to load your servers.</p>
        <button class="btn-secondary" onclick="loadMyServers()">RETRY</button>
      </div>
    `;
  }
}

function createMyServerCard(server) {
  const statusClass = server.status === 'online' ? 'status-online' :
                      server.status === 'provisioning' ? 'status-provisioning' : 'status-offline';

  const expiresIn = server.expiresAt ? formatTimeRemaining(server.expiresAt - Date.now()) : 'N/A';

  return `
    <div class="my-server-card" data-server-id="${server.id}">
      <div class="server-header">
        <span class="server-name">${escapeHtml(server.name)}</span>
        <span class="server-status ${statusClass}">${server.status.toUpperCase()}</span>
      </div>
      <div class="server-game">${escapeHtml(server.game)}</div>

      <div class="server-stats">
        <div class="stat">
          <span class="stat-label">Players</span>
          <span class="stat-value">${server.players.current}/${server.players.max}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Tier</span>
          <span class="stat-value tier-${server.tier}">${server.tier.toUpperCase()}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Expires</span>
          <span class="stat-value">${expiresIn}</span>
        </div>
      </div>

      <div class="server-actions">
        <button class="btn-secondary-small" onclick="manageServer('${server.id}')">MANAGE</button>
        <button class="btn-secondary-small" onclick="extendServer('${server.id}')">EXTEND</button>
      </div>

      <div class="server-connect">
        <code>${server.address}:${server.port}</code>
      </div>
    </div>
  `;
}

function manageServer(serverId) {
  showNotification('Server management coming soon!', 'info');
}

function extendServer(serverId) {
  showNotification('Server extension coming soon!', 'info');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTimeRemaining(ms) {
  if (ms <= 0) return 'Expired';

  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days > 30) {
    const months = Math.floor(days / 30);
    return `${months} month${months > 1 ? 's' : ''}`;
  }
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}`;
  }

  const hours = Math.floor(ms / (60 * 60 * 1000));
  return `${hours} hour${hours > 1 ? 's' : ''}`;
}

function showNotification(message, type = 'info') {
  // Remove existing notification
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => notification.classList.add('show'), 10);

  // Remove after 4 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// ============================================
// EVENT LISTENERS
// ============================================

// Wallet connection
btnConnectWallet.addEventListener('click', connectWallet);
btnDisconnect.addEventListener('click', disconnectWallet);

// Tab navigation
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Server tier selection
document.querySelectorAll('.btn-rent').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectTier(btn.dataset.tier);
  });
});

// Rental form
btnCancelRent.addEventListener('click', cancelRent);
btnConfirmRent.addEventListener('click', confirmRent);
rentalDurationSelect.addEventListener('change', updateOrderSummary);

// Refresh servers
document.getElementById('btn-refresh').addEventListener('click', loadServers);

// Modal close
document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
  el.addEventListener('click', () => {
    serverModal.classList.add('hidden');
    paymentModal.classList.add('hidden');
  });
});

// Payment modal buttons
document.getElementById('btn-view-server').addEventListener('click', () => {
  hidePaymentModal();
  switchTab('my-servers');
  loadMyServers();
});

document.getElementById('btn-retry-payment').addEventListener('click', () => {
  hidePaymentModal();
});

// Rent first server button
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-rent-first')) {
    switchTab('rent');
  }
});

// ============================================
// VISUAL EFFECTS (from main app)
// ============================================

// Custom fire cursor
const cursor = document.getElementById('cursor');
let mouseX = 0, mouseY = 0;
let cursorX = 0, cursorY = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

function animateCursor() {
  cursorX += (mouseX - cursorX) * 0.15;
  cursorY += (mouseY - cursorY) * 0.15;
  cursor.style.left = cursorX + 'px';
  cursor.style.top = cursorY + 'px';
  requestAnimationFrame(animateCursor);
}
animateCursor();

// Cursor particles
function createCursorParticle() {
  const particle = document.createElement('div');
  particle.className = 'cursor-particle';
  particle.style.cssText = `
    position: fixed;
    width: ${Math.random() * 6 + 2}px;
    height: ${Math.random() * 6 + 2}px;
    background: ${Math.random() > 0.5 ? '#ff0033' : '#ff6600'};
    border-radius: 50%;
    pointer-events: none;
    z-index: 9998;
    left: ${cursorX}px;
    top: ${cursorY}px;
    opacity: 1;
    transition: all 0.5s ease-out;
  `;
  document.body.appendChild(particle);

  setTimeout(() => {
    particle.style.transform = `translate(${(Math.random() - 0.5) * 50}px, ${-Math.random() * 50 - 20}px)`;
    particle.style.opacity = '0';
  }, 10);

  setTimeout(() => particle.remove(), 500);
}
setInterval(createCursorParticle, 50);

// Background particles
const particlesContainer = document.getElementById('particles');
function createParticle() {
  const particle = document.createElement('div');
  particle.className = 'particle';
  particle.style.left = Math.random() * 100 + '%';
  particle.style.animationDuration = (Math.random() * 2 + 2) + 's';
  particle.style.animationDelay = Math.random() * 2 + 's';
  particlesContainer.appendChild(particle);
  setTimeout(() => particle.remove(), 5000);
}
setInterval(createParticle, 200);

// Screen flicker
function screenFlicker() {
  if (Math.random() > 0.97) {
    document.body.style.opacity = '0.8';
    setTimeout(() => { document.body.style.opacity = '1'; }, 50);
  }
  requestAnimationFrame(screenFlicker);
}
screenFlicker();

// Glitch text
const glitchText = document.querySelector('.glitch-text');
if (glitchText) {
  setInterval(() => {
    if (Math.random() > 0.95) {
      glitchText.style.transform = `translate(${(Math.random() - 0.5) * 5}px, ${(Math.random() - 0.5) * 5}px)`;
      setTimeout(() => { glitchText.style.transform = ''; }, 100);
    }
  }, 100);
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('%c🔥 GROTTO SERVERS 🔥', 'color: #ff0033; font-size: 30px; font-weight: bold; text-shadow: 0 0 10px #ff0033;');
  console.log('%cGame Server Rental System', 'color: #888; font-size: 14px;');

  // Load public servers
  loadServers();
});
