// Grotto Airdropper - Token Distribution Tool

// Chain configurations
const CHAINS = {
  grotto: {
    name: 'The Grotto L1',
    chainId: 36463,
    rpc: 'https://rpc.grotto.network',
    explorerApi: 'https://grottoexplorer.xyz/api/v2',
    explorer: 'https://grottoexplorer.xyz',
    nativeCurrency: { name: 'HERESY', symbol: 'HERESY', decimals: 18 },
    airdropperContract: '0x7d2cddB4019C0d3fDe96716AD6145885af4b4c64',
    presetTokens: {
      'native': { name: 'HERESY', symbol: 'HERESY', decimals: 18, address: null },
      '0x4CEE1f4b3808db3c6f47d521E2AB73c0A2126301': { name: 'Greg', symbol: 'GREG', decimals: 18 },
      '0x1FB721Afd78175B94a5E66AA8a46Fb024bDFBE39': { name: 'NAPOLEON', symbol: 'NPL', decimals: 18 }
    }
  },
  avax: {
    name: 'Avalanche C-Chain',
    chainId: 43114,
    rpc: 'https://api.avax.network/ext/bc/C/rpc',
    explorerApi: 'https://api.snowtrace.io/api',
    explorer: 'https://snowtrace.io',
    nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
    airdropperContract: '0xb37a53Eade3Aeb2bb2De9dCA343D54845CBFDbE2',
    presetTokens: {
      'native': { name: 'AVAX', symbol: 'AVAX', decimals: 18, address: null }
    }
  }
};

// Current chain (default to Grotto)
let currentChain = 'grotto';
const GROTTO_API = 'https://api.enterthegrotto.xyz';

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

// ABI for OpenAirdropper contract (permissionless)
const AIRDROPPER_ABI = [
  'function airdropERC20(address _tokenAddress, tuple(address recipient, uint256 amount)[] _contents) external',
  'function airdropERC721(address _tokenAddress, tuple(address recipient, uint256 tokenId)[] _contents) external',
  'function airdropERC1155(address _tokenAddress, tuple(address recipient, uint256 tokenId, uint256 amount)[] _contents) external',
  'function airdropNativeToken(tuple(address recipient, uint256 amount)[] _contents) external payable',
  'function airdropERC20Equal(address _tokenAddress, address[] _recipients, uint256 _amountEach) external',
  'function airdropNativeTokenEqual(address[] _recipients, uint256 _amountEach) external payable'
];

// State
let provider, signer, walletAddress;
let holders = [];
let selectedToken = null;
let isNativeToken = false;
let tokenContract = null;
let airdropperContract = null;
let currentEthProvider = null;

// DOM helpers
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// Helper to get current chain config
function getChainConfig() {
  return CHAINS[currentChain];
}

// ============================================
// CHAIN SWITCHING
// ============================================

async function switchChain(chainKey) {
  currentChain = chainKey;
  const chain = getChainConfig();

  // Update UI
  $('selected-chain').textContent = chain.name;
  updatePresetTokens();

  // If wallet connected, switch chain
  if (currentEthProvider && walletAddress) {
    try {
      await currentEthProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + chain.chainId.toString(16) }]
      });
    } catch (e) {
      if (e.code === 4902) {
        await currentEthProvider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x' + chain.chainId.toString(16),
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: [chain.rpc],
            blockExplorerUrls: [chain.explorer]
          }]
        });
      }
    }

    // Reinitialize provider and contract
    provider = new ethers.providers.Web3Provider(currentEthProvider);
    signer = provider.getSigner();

    if (chain.airdropperContract) {
      airdropperContract = new ethers.Contract(chain.airdropperContract, AIRDROPPER_ABI, signer);
    }
  }

  // Close dropdown
  $('chain-dropdown').classList.add('hidden');
}

function updatePresetTokens() {
  const chain = getChainConfig();
  const dropdown = $('token-dropdown');
  if (!dropdown) return;

  // Clear existing options except custom
  const customOption = dropdown.querySelector('.token-custom');
  dropdown.innerHTML = '';

  // Add preset tokens for current chain
  for (const [addr, token] of Object.entries(chain.presetTokens)) {
    const div = document.createElement('div');
    div.className = 'token-option';
    div.dataset.value = addr;
    div.onclick = () => selectToken(addr, div);
    div.innerHTML = `
      <span class="token-icon-fallback">${token.symbol[0]}</span>
      <div class="token-details">
        <span class="token-name">${token.symbol}</span>
        <span class="token-label">${token.name}</span>
      </div>
    `;
    dropdown.appendChild(div);
  }

  // Re-add custom option
  const customDiv = document.createElement('div');
  customDiv.className = 'token-option token-custom';
  customDiv.dataset.value = 'custom';
  customDiv.onclick = () => selectToken('custom', customDiv);
  customDiv.innerHTML = `
    <span class="token-icon-fallback">+</span>
    <div class="token-details">
      <span class="token-name">Custom Token</span>
      <span class="token-label">Enter contract address</span>
    </div>
  `;
  dropdown.appendChild(customDiv);

  // Reset selection
  $('token-selected').innerHTML = '<span class="token-placeholder">-- Select Token --</span>';
  $('token-select').value = '';
}

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
  const chain = getChainConfig();

  try {
    const accounts = await eth.request({ method: 'eth_requestAccounts' });
    walletAddress = accounts[0];

    provider = new ethers.providers.Web3Provider(eth);
    signer = provider.getSigner();

    // Switch to selected chain if needed
    const network = await provider.getNetwork();
    if (network.chainId !== chain.chainId) {
      try {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + chain.chainId.toString(16) }]
        });
      } catch (e) {
        if (e.code === 4902) {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x' + chain.chainId.toString(16),
              chainName: chain.name,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: [chain.rpc],
              blockExplorerUrls: [chain.explorer]
            }]
          });
        } else {
          throw e;
        }
      }
      provider = new ethers.providers.Web3Provider(eth);
      signer = provider.getSigner();
    }

    // Initialize airdropper contract (permissionless - no owner check needed)
    if (chain.airdropperContract) {
      airdropperContract = new ethers.Contract(chain.airdropperContract, AIRDROPPER_ABI, signer);
    }

    // Update UI - permissionless, so always show main interface
    $('wallet-address').textContent = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
    $('chain-badge').textContent = chain.name.split(' ')[0].toUpperCase(); // "GROTTO" or "AVALANCHE"
    $('pre-connect-section').classList.add('hidden');
    $('connected-header').classList.remove('hidden');
    $('airdropper-main').classList.remove('hidden');
    $('connect-prompt').classList.add('hidden');
    $('not-owner-prompt').classList.add('hidden');

    // Listen for account changes
    eth.on('accountsChanged', async (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        walletAddress = accounts[0];
        signer = provider.getSigner();
        const currentChainConfig = getChainConfig();
        if (currentChainConfig.airdropperContract) {
          airdropperContract = new ethers.Contract(currentChainConfig.airdropperContract, AIRDROPPER_ABI, signer);
        }
        $('wallet-address').textContent = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
      }
    });

    // Listen for chain changes
    eth.on('chainChanged', (chainId) => {
      // Reload to reset state
      window.location.reload();
    });

  } catch (e) {
    console.error(e);
    alert('Failed to connect wallet: ' + e.message);
  }
}

function disconnectWallet() {
  provider = signer = walletAddress = null;
  $('connected-header').classList.add('hidden');
  $('pre-connect-section').classList.remove('hidden');
  $('airdropper-main').classList.add('hidden');
  $('connect-prompt').classList.remove('hidden');

  // Reset to step 1
  $('section-snapshot').classList.remove('hidden');
  $('section-configure').classList.add('hidden');
  $('section-execute').classList.add('hidden');

  // Clear holders
  holders = [];
}

// ============================================
// GROTTO SEARCH
// ============================================

async function searchGrotto() {
  const query = $('grotto-search').value.trim();
  if (query.length < 2) {
    return alert('Enter at least 2 characters to search');
  }

  // Get selected types
  const types = [];
  if ($('filter-games').checked) types.push('games');
  if ($('filter-assets').checked) types.push('assets');
  if ($('filter-packs').checked) types.push('packs');

  if (types.length === 0) {
    return alert('Select at least one type to search');
  }

  const resultsContainer = $('search-results');
  const resultsList = $('search-results-list');

  resultsContainer.classList.remove('hidden');
  resultsList.innerHTML = '<div class="search-loading">Searching...</div>';

  try {
    const url = `${GROTTO_API}/api/search/detailed?q=${encodeURIComponent(query)}&types=${types.join(',')}&limit=20`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Search failed');
    }

    const data = await response.json();

    // Combine all results
    const allResults = [
      ...(data.games || []).map(r => ({ ...r, type: 'game' })),
      ...(data.assets || []).map(r => ({ ...r, type: 'asset' })),
      ...(data.packs || []).map(r => ({ ...r, type: 'pack' }))
    ];

    if (allResults.length === 0) {
      resultsList.innerHTML = '<div class="search-no-results">No results found</div>';
      return;
    }

    renderSearchResults(allResults);

  } catch (e) {
    console.error('Search error:', e);
    resultsList.innerHTML = '<div class="search-no-results">Search failed. Try again.</div>';
  }
}

function renderSearchResults(results) {
  const resultsList = $('search-results-list');
  resultsList.innerHTML = '';

  for (const item of results) {
    const div = document.createElement('div');
    div.className = 'search-result-item';
    div.onclick = () => selectSearchResult(item);

    // Get contract address based on type
    let contractAddr = '';
    let tokenId = '';
    if (item.type === 'game') {
      contractAddr = item.license_address || item.token_address || '';
      tokenId = item.license_token_id || '';
    } else {
      contractAddr = item.collection_address || '';
      tokenId = item.token_id || '';
    }

    div.innerHTML = `
      <img class="search-result-thumb" src="${item.thumbnail_url || ''}" alt="" onerror="this.style.display='none'">
      <div class="search-result-info">
        <div class="search-result-name">${escapeHtml(item.name)}</div>
        <div class="search-result-meta">
          <span class="search-result-type">${item.type}</span>
          ${contractAddr ? `<span>${contractAddr.slice(0, 8)}...${contractAddr.slice(-6)}</span>` : ''}
          ${tokenId ? `<span>ID: ${tokenId}</span>` : ''}
        </div>
      </div>
    `;

    resultsList.appendChild(div);
  }
}

function selectSearchResult(item) {
  // Get contract address based on type
  let contractAddr = '';
  let tokenId = '';
  let contractType = 'erc1155'; // Most Grotto items are ERC1155

  if (item.type === 'game') {
    contractAddr = item.license_address || item.token_address || '';
    tokenId = item.license_token_id || '0';
  } else {
    contractAddr = item.collection_address || '';
    tokenId = item.token_id || '';
  }

  if (!contractAddr) {
    alert('No contract address found for this item');
    return;
  }

  // Fill in the form
  $('snapshot-contract').value = contractAddr;
  $('contract-type').value = contractType;

  // Show and fill token ID for ERC1155
  if (tokenId) {
    $('token-id-row').style.display = 'block';
    $('erc1155-token-id').value = tokenId;
  }

  // Hide search results
  $('search-results').classList.add('hidden');

  // Clear search
  $('grotto-search').value = '';

  // Visual feedback
  $('snapshot-contract').style.borderColor = 'var(--red)';
  setTimeout(() => {
    $('snapshot-contract').style.borderColor = '';
  }, 1000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// HOLDER SNAPSHOT
// ============================================

async function fetchHolders() {
  const contractAddr = $('snapshot-contract').value.trim();
  const contractType = $('contract-type').value;
  const chain = getChainConfig();

  if (!contractAddr || !ethers.utils.isAddress(contractAddr)) {
    return alert('Enter a valid contract address');
  }

  showModal('Fetching holders...');

  try {
    // Use explorer API for current chain
    const response = await fetch(`${chain.explorerApi}/tokens/${contractAddr}/holders?limit=1000`);

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

function toggleChainDropdown() {
  const dropdown = $('chain-dropdown');
  const selected = $('chain-selected');
  dropdown.classList.toggle('hidden');
  selected.classList.toggle('open');
}

function closeChainDropdown() {
  $('chain-dropdown').classList.add('hidden');
  $('chain-selected').classList.remove('open');
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

  // Clear if empty
  if (!addr) {
    $('token-info').classList.add('hidden');
    return;
  }

  // Validate address format
  if (!ethers.utils.isAddress(addr)) {
    return; // Don't show error while typing, just wait for valid address
  }

  isNativeToken = false;
  await loadTokenInfo(addr);
}

// Auto-fetch token info when pasting address
async function onCustomTokenInput() {
  const addr = $('custom-token-address').value.trim();

  // Only auto-fetch if it looks like a complete address
  if (addr.length === 42 && ethers.utils.isAddress(addr)) {
    await loadCustomToken();
  }
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
      tokenContract.allowance(walletAddress, getChainConfig().airdropperContract)
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
    const tx = await tokenContract.approve(getChainConfig().airdropperContract, ethers.constants.MaxUint256);

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

  // Build contents array: [{ recipient: address, amount: uint256 }, ...]
  const contents = [];
  const decimals = selectedToken.decimals;

  for (const holder of holders) {
    if (holder.amount && parseFloat(holder.amount) > 0) {
      contents.push({
        recipient: holder.address,
        amount: ethers.utils.parseUnits(holder.amount, decimals)
      });
    }
  }

  if (contents.length === 0) {
    return alert('No amounts set. Please configure amounts for at least one holder.');
  }

  // Debug logging
  console.log('Airdrop params:', {
    token: isNativeToken ? 'NATIVE' : selectedToken.address,
    contents: contents.map(c => ({ recipient: c.recipient, amount: c.amount.toString() })),
    recipientCount: contents.length
  });

  showModal('Confirm transaction in wallet...');

  try {
    let tx;
    const gasLimit = 100000 + (contents.length * 60000); // Estimate gas based on recipient count

    if (isNativeToken) {
      // For native token, use airdropNativeToken function
      const totalValue = contents.reduce((sum, c) => sum.add(c.amount), ethers.BigNumber.from(0));
      tx = await airdropperContract.airdropNativeToken(
        contents,
        { value: totalValue, gasLimit }
      );
    } else {
      // ERC20 airdrop - verify approval first
      const allowance = await tokenContract.allowance(walletAddress, getChainConfig().airdropperContract);
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
        contents,
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

  // Grotto Search
  $('btn-search').onclick = searchGrotto;
  $('grotto-search').onkeypress = (e) => {
    if (e.key === 'Enter') searchGrotto();
  };

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

  // Custom token auto-fetch on paste/input
  const customTokenInput = $('custom-token-address');
  customTokenInput.onchange = loadCustomToken;
  customTokenInput.oninput = onCustomTokenInput;
  customTokenInput.onpaste = () => {
    // Small delay to let paste complete
    setTimeout(onCustomTokenInput, 100);
  };

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.token-selector')) {
      closeTokenDropdown();
    }
    if (!e.target.closest('.chain-selector')) {
      closeChainDropdown();
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

  // Click/hold particle burst effect
  let isMouseDown = false;
  let clickParticleInterval = null;

  function createClickParticle() {
    const colors = ['#ff0033', '#ff6600', '#ffcc00', '#ff4400', '#ff8800'];
    const particle = document.createElement('div');
    particle.className = 'click-particle';
    const size = Math.random() * 4 + 2;
    particle.style.cssText = `
      position: fixed;
      width: ${size}px;
      height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: 50%;
      pointer-events: none;
      z-index: 9998;
      left: ${cursorX}px;
      top: ${cursorY}px;
      opacity: 1;
      box-shadow: 0 0 ${size}px currentColor;
    `;
    document.body.appendChild(particle);

    // Random direction burst
    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 80 + 40;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;

    let x = 0, y = 0, opacity = 1;
    const animate = () => {
      x += vx * 0.02;
      y += vy * 0.02 + 1; // slight gravity
      opacity -= 0.03;
      particle.style.transform = `translate(${x}px, ${y}px)`;
      particle.style.opacity = opacity;
      if (opacity > 0) {
        requestAnimationFrame(animate);
      } else {
        particle.remove();
      }
    };
    requestAnimationFrame(animate);
  }

  function startClickParticles() {
    isMouseDown = true;
    // Burst on initial click
    for (let i = 0; i < 8; i++) {
      createClickParticle();
    }
    // Continue spawning while held
    clickParticleInterval = setInterval(() => {
      for (let i = 0; i < 3; i++) {
        createClickParticle();
      }
    }, 30);
  }

  function stopClickParticles() {
    isMouseDown = false;
    if (clickParticleInterval) {
      clearInterval(clickParticleInterval);
      clickParticleInterval = null;
    }
  }

  document.addEventListener('mousedown', startClickParticles);
  document.addEventListener('mouseup', stopClickParticles);
  document.addEventListener('mouseleave', stopClickParticles);

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
