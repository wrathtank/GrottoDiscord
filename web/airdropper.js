// Grotto Airdropper - Token Distribution Tool

const GROTTO_CHAIN_ID = 36463;
const GROTTO_RPC = 'https://rpc.grotto.network';
const GROTTO_EXPLORER_API = 'https://grottoexplorer.xyz/api/v2';

// Airdropper Contract (EIP-1167 proxy)
const AIRDROPPER_CONTRACT = '0xc71b2Bfb7B6532E1e3e148CD8bd064b2D85eaf7f';

// Preset Tokens with icons
// Icons can be updated with actual URLs when available
const PRESET_TOKENS = {
  'native': {
    name: 'HERESY',
    symbol: 'HERESY',
    decimals: 18,
    address: null,
    icon: 'https://raw.githubusercontent.com/thegrotto/assets/main/tokens/heresy.png'
  },
  '0x4CEE1f4b3808db3c6f47d521E2AB73c0A2126301': {
    name: 'Greg',
    symbol: 'GREG',
    decimals: 18,
    icon: 'https://raw.githubusercontent.com/thegrotto/assets/main/tokens/greg.png'
  },
  '0x1FB721Afd78175B94a5E66AA8a46Fb024bDFBE39': {
    name: 'NAPOLEON',
    symbol: 'NPL',
    decimals: 18,
    icon: 'https://raw.githubusercontent.com/thegrotto/assets/main/tokens/npl.png'
  }
};

// ABIs
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)'
];

const ERC721_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)'
];

const AIRDROPPER_ABI = [
  'function owner() view returns (address)',
  'function airdropERC20(address token, address[] recipients, uint256[] amounts) external payable',
  'function airdropERC721(address nftContract, address[] recipients, uint256[] tokenIds) external',
  'function airdropERC1155(address nftContract, address[] recipients, uint256[] tokenIds, uint256[] amounts) external'
];

// State
let provider, signer, walletAddress;
let holders = [];
let selectedToken = null;
let isNativeToken = false;
let tokenContract = null;
let airdropperContract = null;
let isContractOwner = false;
let currentEthProvider = null;

// DOM helpers
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ============================================
// WALLET CONNECTION
// ============================================

function showWalletModal() {
  $('wallet-modal').classList.remove('hidden');
}

function closeWalletModal() {
  $('wallet-modal').classList.add('hidden');
}

function getWalletProvider(walletType) {
  // Check for specific wallet providers
  if (walletType === 'metamask') {
    // MetaMask injects as window.ethereum with isMetaMask
    if (window.ethereum?.isMetaMask) return window.ethereum;
    // Check providers array if multiple wallets installed
    if (window.ethereum?.providers) {
      return window.ethereum.providers.find(p => p.isMetaMask);
    }
    return null;
  }

  if (walletType === 'rabby') {
    // Rabby injects as window.ethereum with isRabby
    if (window.ethereum?.isRabby) return window.ethereum;
    if (window.ethereum?.providers) {
      return window.ethereum.providers.find(p => p.isRabby);
    }
    return null;
  }

  if (walletType === 'core') {
    // Core/Avalanche wallet injects as window.avalanche
    if (window.avalanche) return window.avalanche;
    // Also check window.ethereum for Core
    if (window.ethereum?.isAvalanche) return window.ethereum;
    if (window.ethereum?.providers) {
      return window.ethereum.providers.find(p => p.isAvalanche);
    }
    return null;
  }

  // Fallback to any available
  return window.avalanche || window.ethereum;
}

async function connectWithWallet(walletType) {
  closeWalletModal();

  const eth = getWalletProvider(walletType);

  if (!eth) {
    const walletNames = { metamask: 'MetaMask', rabby: 'Rabby', core: 'Core Wallet' };
    alert(`${walletNames[walletType] || 'Wallet'} not detected. Please install it first.`);
    return;
  }

  currentEthProvider = eth;

  try {
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
              rpcUrls: [GROTTO_RPC],
              blockExplorerUrls: ['https://grottoexplorer.xyz']
            }]
          });
        } else {
          throw e;
        }
      }
      provider = new ethers.providers.Web3Provider(eth);
      signer = provider.getSigner();
    }

    // Initialize airdropper contract
    airdropperContract = new ethers.Contract(AIRDROPPER_CONTRACT, AIRDROPPER_ABI, signer);

    // Check if user is contract owner
    try {
      const owner = await airdropperContract.owner();
      isContractOwner = owner.toLowerCase() === walletAddress.toLowerCase();
    } catch (e) {
      console.error('Failed to check owner:', e);
      isContractOwner = false;
    }

    // Update UI
    $('wallet-address').textContent = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
    $('wallet-disconnected').classList.add('hidden');
    $('wallet-connected').classList.remove('hidden');

    if (isContractOwner) {
      $('airdropper-main').classList.remove('hidden');
      $('connect-prompt').classList.add('hidden');
      $('not-owner-prompt').classList.add('hidden');
    } else {
      $('airdropper-main').classList.add('hidden');
      $('connect-prompt').classList.add('hidden');
      $('not-owner-prompt').classList.remove('hidden');
    }

    // Listen for account changes
    eth.on('accountsChanged', async (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        // Re-connect with new account to re-check ownership
        walletAddress = accounts[0];
        signer = provider.getSigner();
        airdropperContract = new ethers.Contract(AIRDROPPER_CONTRACT, AIRDROPPER_ABI, signer);

        try {
          const owner = await airdropperContract.owner();
          isContractOwner = owner.toLowerCase() === walletAddress.toLowerCase();
        } catch (e) {
          isContractOwner = false;
        }

        $('wallet-address').textContent = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);

        if (isContractOwner) {
          $('airdropper-main').classList.remove('hidden');
          $('not-owner-prompt').classList.add('hidden');
        } else {
          $('airdropper-main').classList.add('hidden');
          $('not-owner-prompt').classList.remove('hidden');
        }
      }
    });

  } catch (e) {
    console.error(e);
    alert('Failed to connect wallet: ' + e.message);
  }
}

function disconnectWallet() {
  provider = signer = walletAddress = null;
  isContractOwner = false;
  $('wallet-connected').classList.add('hidden');
  $('wallet-disconnected').classList.remove('hidden');
  $('airdropper-main').classList.add('hidden');
  $('not-owner-prompt').classList.add('hidden');
  $('connect-prompt').classList.remove('hidden');
}

// ============================================
// HOLDER SNAPSHOT
// ============================================

async function fetchHolders() {
  const contractAddr = $('snapshot-contract').value.trim();
  const contractType = $('contract-type').value;

  if (!contractAddr || !ethers.utils.isAddress(contractAddr)) {
    return alert('Enter a valid contract address');
  }

  showModal('Fetching holders...');

  try {
    // Use Blockscout V2 API
    const response = await fetch(`${GROTTO_EXPLORER_API}/tokens/${contractAddr}/holders?limit=1000`);

    if (!response.ok) {
      throw new Error('Failed to fetch holders from explorer');
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      hideModal();
      return alert('No holders found for this contract');
    }

    // Parse holder data
    holders = data.items.map(item => ({
      address: item.address.hash,
      balance: item.value || '0',
      amount: '0'
    }));

    // Filter out zero balances and contract addresses if needed
    holders = holders.filter(h => h.balance !== '0');

    showConfigureSection();
    hideModal();

  } catch (e) {
    console.error(e);
    hideModal();
    alert('Failed to fetch holders: ' + e.message + '\n\nTry uploading a CSV instead.');
  }
}

function handleCSVUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const lines = text.split(/[\n,]/).map(l => l.trim()).filter(l => l);

      // Extract addresses
      const addresses = [];
      for (const line of lines) {
        // Handle various CSV formats: just address, or address,amount
        const parts = line.split(',').map(p => p.trim());
        const addr = parts[0];

        if (ethers.utils.isAddress(addr)) {
          addresses.push({
            address: addr,
            balance: parts[1] || '0',
            amount: '0'
          });
        }
      }

      if (addresses.length === 0) {
        return alert('No valid addresses found in CSV');
      }

      holders = addresses;
      showConfigureSection();

    } catch (err) {
      alert('Failed to parse CSV: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ============================================
// CONFIGURE AMOUNTS
// ============================================

function showConfigureSection() {
  $('section-snapshot').classList.add('hidden');
  $('section-configure').classList.remove('hidden');
  $('section-execute').classList.remove('hidden');

  updateHolderCount();
  renderHoldersTable();
}

function updateHolderCount() {
  $('holder-count').textContent = holders.length;
  $('summary-recipients').textContent = holders.length;
  updateTotalAmount();
}

function updateTotalAmount() {
  let total = ethers.BigNumber.from(0);
  const decimals = selectedToken?.decimals || 18;

  for (const holder of holders) {
    if (holder.amount && holder.amount !== '0') {
      try {
        total = total.add(ethers.utils.parseUnits(holder.amount, decimals));
      } catch (e) {
        // Skip invalid amounts
      }
    }
  }

  const formatted = ethers.utils.formatUnits(total, decimals);
  $('total-amount').textContent = parseFloat(formatted).toLocaleString();
  $('summary-total').textContent = parseFloat(formatted).toLocaleString();
  $('token-required').textContent = parseFloat(formatted).toLocaleString() + ' ' + (selectedToken?.symbol || '');
}

function renderHoldersTable() {
  const tbody = $('holders-tbody');
  tbody.innerHTML = '';

  for (let i = 0; i < holders.length; i++) {
    const h = holders[i];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="addr">${h.address.slice(0, 8)}...${h.address.slice(-6)}</td>
      <td>${formatBalance(h.balance)}</td>
      <td><input type="number" class="holder-amount" data-index="${i}" value="${h.amount}" step="any" min="0" placeholder="0.0"></td>
    `;
    tbody.appendChild(tr);
  }

  // Add input listeners
  $$('.holder-amount').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index);
      holders[idx].amount = e.target.value || '0';
      updateTotalAmount();
    });
  });
}

function setEqualAmounts() {
  const amount = $('equal-amount').value;
  if (!amount || parseFloat(amount) <= 0) return;

  for (const holder of holders) {
    holder.amount = amount;
  }

  // Update table inputs
  $$('.holder-amount').forEach(input => {
    input.value = amount;
  });

  updateTotalAmount();
}

function switchAmountMode(mode) {
  $$('.mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
  $('equal-mode').classList.toggle('hidden', mode !== 'equal');
  $('individual-mode').classList.toggle('hidden', mode !== 'individual');
}

function downloadCSV() {
  const decimals = selectedToken?.decimals || 18;
  let csv = 'address,balance,amount\n';

  for (const h of holders) {
    csv += `${h.address},${formatBalance(h.balance)},${h.amount}\n`;
  }

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'airdrop_snapshot.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================
// TOKEN SELECTION (Custom Dropdown)
// ============================================

function toggleTokenDropdown() {
  const dropdown = $('token-dropdown');
  const selected = $('token-selected');
  dropdown.classList.toggle('hidden');
  selected.classList.toggle('open');
}

function closeTokenDropdown() {
  $('token-dropdown').classList.add('hidden');
  $('token-selected').classList.remove('open');
}

async function selectToken(value, element) {
  closeTokenDropdown();
  $('token-select').value = value;

  // Update selected display
  const selectedContainer = $('token-selected');
  if (value && value !== 'custom') {
    const clone = element.cloneNode(true);
    selectedContainer.innerHTML = '';
    selectedContainer.appendChild(clone.querySelector('.token-icon') || clone.querySelector('.token-icon-fallback').cloneNode(true));
    selectedContainer.appendChild(clone.querySelector('.token-details').cloneNode(true));
  } else if (value === 'custom') {
    selectedContainer.innerHTML = '<span class="token-placeholder">Custom Token</span>';
  } else {
    selectedContainer.innerHTML = '<span class="token-placeholder">-- Select Token --</span>';
  }

  await handleTokenSelect();
}

async function handleTokenSelect() {
  const value = $('token-select').value;

  if (value === 'custom') {
    $('custom-token-row').classList.remove('hidden');
    return;
  }

  $('custom-token-row').classList.add('hidden');

  if (!value) {
    $('token-info').classList.add('hidden');
    $('approval-section').classList.add('hidden');
    $('btn-execute').disabled = true;
    selectedToken = null;
    return;
  }

  if (value === 'native') {
    // Native HERESY
    isNativeToken = true;
    selectedToken = PRESET_TOKENS['native'];
    tokenContract = null;
    await updateNativeBalance();
    $('approval-section').classList.add('hidden');
  } else {
    // ERC20 token
    isNativeToken = false;
    await loadTokenInfo(value);
  }
}

async function loadCustomToken() {
  const addr = $('custom-token-address').value.trim();
  if (!addr || !ethers.utils.isAddress(addr)) {
    return alert('Enter a valid token address');
  }

  isNativeToken = false;
  await loadTokenInfo(addr);
}

async function loadTokenInfo(tokenAddress) {
  showModal('Loading token info...');

  try {
    tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

    const [name, symbol, decimals, balance, allowance] = await Promise.all([
      tokenContract.name(),
      tokenContract.symbol(),
      tokenContract.decimals(),
      tokenContract.balanceOf(walletAddress),
      tokenContract.allowance(walletAddress, AIRDROPPER_CONTRACT)
    ]);

    selectedToken = { address: tokenAddress, name, symbol, decimals };

    // Update UI
    $('token-name').textContent = name;
    $('token-symbol').textContent = symbol;
    $('token-balance').textContent = parseFloat(ethers.utils.formatUnits(balance, decimals)).toLocaleString() + ' ' + symbol;
    $('summary-token').textContent = symbol;
    $('token-info').classList.remove('hidden');

    // Check if approval needed
    const totalRequired = calculateTotalRequired();
    if (allowance.lt(totalRequired)) {
      $('approval-section').classList.remove('hidden');
      $('btn-execute').disabled = true;
    } else {
      $('approval-section').classList.add('hidden');
      $('btn-execute').disabled = false;
    }

    updateTotalAmount();
    hideModal();

  } catch (e) {
    console.error(e);
    hideModal();
    alert('Failed to load token: ' + e.message);
  }
}

async function updateNativeBalance() {
  try {
    const balance = await provider.getBalance(walletAddress);
    $('token-name').textContent = 'HERESY';
    $('token-symbol').textContent = 'HERESY';
    $('token-balance').textContent = parseFloat(ethers.utils.formatEther(balance)).toLocaleString() + ' HERESY';
    $('summary-token').textContent = 'HERESY (Native)';
    $('token-info').classList.remove('hidden');
    $('btn-execute').disabled = false;
    updateTotalAmount();
  } catch (e) {
    console.error(e);
  }
}

function calculateTotalRequired() {
  let total = ethers.BigNumber.from(0);
  const decimals = selectedToken?.decimals || 18;

  for (const holder of holders) {
    if (holder.amount && parseFloat(holder.amount) > 0) {
      total = total.add(ethers.utils.parseUnits(holder.amount, decimals));
    }
  }

  return total;
}

// ============================================
// APPROVAL & EXECUTION
// ============================================

async function approveToken() {
  if (!tokenContract || !selectedToken) return;

  showModal('Requesting approval...');

  try {
    const totalRequired = calculateTotalRequired();
    const tx = await tokenContract.approve(AIRDROPPER_CONTRACT, ethers.constants.MaxUint256);

    $('tx-message').textContent = 'Waiting for confirmation...';
    await tx.wait();

    $('approval-section').classList.add('hidden');
    $('btn-execute').disabled = false;
    hideModal();

  } catch (e) {
    console.error(e);
    hideModal();
    alert('Approval failed: ' + e.message);
  }
}

async function executeAirdrop() {
  if (!selectedToken || holders.length === 0) return;

  // Filter holders with amounts > 0
  const recipients = [];
  const amounts = [];
  const decimals = selectedToken.decimals;

  for (const holder of holders) {
    if (holder.amount && parseFloat(holder.amount) > 0) {
      recipients.push(holder.address);
      amounts.push(ethers.utils.parseUnits(holder.amount, decimals));
    }
  }

  if (recipients.length === 0) {
    return alert('No amounts set. Please configure amounts for at least one holder.');
  }

  // Debug logging
  console.log('Airdrop params:', {
    token: isNativeToken ? 'NATIVE (zero address)' : selectedToken.address,
    recipients: recipients,
    amounts: amounts.map(a => a.toString()),
    recipientCount: recipients.length
  });

  showModal('Confirm transaction in wallet...');

  try {
    let tx;
    const gasLimit = 100000 + (recipients.length * 50000); // Estimate gas based on recipient count

    if (isNativeToken) {
      // For native token, we need to send value
      const totalValue = amounts.reduce((a, b) => a.add(b), ethers.BigNumber.from(0));
      tx = await airdropperContract.airdropERC20(
        ethers.constants.AddressZero,
        recipients,
        amounts,
        { value: totalValue, gasLimit }
      );
    } else {
      // ERC20 airdrop - verify approval first
      const allowance = await tokenContract.allowance(walletAddress, AIRDROPPER_CONTRACT);
      const totalRequired = calculateTotalRequired();

      if (allowance.lt(totalRequired)) {
        hideModal();
        alert('Insufficient token approval. Please approve the tokens first.');
        $('approval-section').classList.remove('hidden');
        $('btn-execute').disabled = true;
        return;
      }

      // Check balance
      const balance = await tokenContract.balanceOf(walletAddress);
      if (balance.lt(totalRequired)) {
        hideModal();
        alert('Insufficient token balance. You need ' + ethers.utils.formatUnits(totalRequired, decimals) + ' ' + selectedToken.symbol);
        return;
      }

      tx = await airdropperContract.airdropERC20(
        selectedToken.address,
        recipients,
        amounts,
        { gasLimit }
      );
    }

    $('tx-message').textContent = 'Processing transaction...';
    await tx.wait();

    $('tx-message').textContent = 'Airdrop successful!';
    setTimeout(() => {
      hideModal();
      alert('Airdrop completed successfully!\n\nTx: ' + tx.hash);
    }, 1500);

  } catch (e) {
    console.error('Airdrop error:', e);
    hideModal();

    // Parse error for better message
    let errorMsg = e.message || 'Unknown error';
    if (e.reason) errorMsg = e.reason;
    if (e.error?.message) errorMsg = e.error.message;

    // Check for common issues
    if (errorMsg.includes('execution reverted')) {
      errorMsg += '\n\nThe contract rejected the transaction. This could mean:\n- You are not the contract owner\n- Token not approved\n- Invalid parameters';
    }

    alert('Airdrop failed: ' + errorMsg);
  }
}

// ============================================
// UI HELPERS
// ============================================

function showModal(message) {
  $('tx-message').textContent = message;
  $('tx-modal').classList.remove('hidden');
}

function hideModal() {
  $('tx-modal').classList.add('hidden');
}

function formatBalance(balance) {
  if (!balance || balance === '0') return '0';
  try {
    const formatted = ethers.utils.formatUnits(balance, 18);
    const num = parseFloat(formatted);
    if (num > 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num > 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(4);
  } catch (e) {
    return balance;
  }
}

function goBack(step) {
  if (step === 'snapshot') {
    $('section-snapshot').classList.remove('hidden');
    $('section-configure').classList.add('hidden');
    $('section-execute').classList.add('hidden');
  } else if (step === 'configure') {
    $('section-configure').classList.remove('hidden');
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Wallet
  $('btn-connect-wallet').onclick = showWalletModal;
  $('btn-disconnect').onclick = disconnectWallet;

  // Wallet selector options
  $$('.wallet-option').forEach(opt => {
    opt.onclick = () => connectWithWallet(opt.dataset.wallet);
  });

  // Snapshot
  $('btn-snapshot').onclick = fetchHolders;
  $('csv-upload').onchange = handleCSVUpload;

  // Contract type change (show/hide ERC1155 token ID)
  $('contract-type').onchange = () => {
    $('token-id-row').style.display = $('contract-type').value === 'erc1155' ? 'block' : 'none';
  };

  // Configure
  $$('.mode-btn').forEach(btn => {
    btn.onclick = () => switchAmountMode(btn.dataset.mode);
  });
  $('equal-amount').oninput = setEqualAmounts;
  $('btn-download-csv').onclick = downloadCSV;
  $('btn-back-snapshot').onclick = () => goBack('snapshot');

  // Token selection (custom dropdown)
  $$('.token-option').forEach(opt => {
    opt.onclick = () => selectToken(opt.dataset.value, opt);
  });
  $('custom-token-address').onchange = loadCustomToken;

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.token-selector')) {
      closeTokenDropdown();
    }
  });

  // Execute
  $('btn-approve').onclick = approveToken;
  $('btn-execute').onclick = executeAirdrop;
  $('btn-back-configure').onclick = () => goBack('configure');

  // Modal close on background click
  $('tx-modal').querySelector('.modal-bg').onclick = hideModal;

  // Initialize visual effects
  initVisualEffects();
});

// ============================================
// VISUAL EFFECTS (from servers.js)
// ============================================

function initVisualEffects() {
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
    if (cursor) {
      cursor.style.left = cursorX + 'px';
      cursor.style.top = cursorY + 'px';
    }
    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  // Create fire particles on cursor
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

  // Glitch effect on hover for fire buttons
  document.querySelectorAll('.btn-fire').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.animation = 'glitch 0.3s infinite';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.animation = '';
    });
  });

  // Random screen flicker effect
  function screenFlicker() {
    if (Math.random() > 0.97) {
      document.body.style.opacity = '0.8';
      setTimeout(() => document.body.style.opacity = '1', 50);
    }
    setTimeout(screenFlicker, 100);
  }
  screenFlicker();
}
