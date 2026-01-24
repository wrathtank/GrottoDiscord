// Grotto Server Panel - Simple Settings Interface

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://grotto-discord-bot-7dcd8c6451fc.herokuapp.com';

const urlParams = new URLSearchParams(window.location.search);
const serverId = urlParams.get('server');

if (!serverId) {
  alert('No server specified');
  window.location.href = '/servers';
}

let server = null;
let walletAddress = null;
let isOwner = false;
let apiKeyVisible = false;
let pollInterval = null;

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// Code snippets for Unity integration
const codeSnippets = {
  host: `// Host a new game
GrottoNetwork.HostLobby("My Lobby", maxPlayers: 8, isPublic: true);

// Called when hosting succeeds
GrottoNetwork.OnLobbyCreated += (lobby) => {
    Debug.Log($"Lobby created: {lobby.Code}");
    // Start your game scene
    SceneManager.LoadScene("GameScene");
};

// Called when a player joins your lobby
GrottoNetwork.OnPlayerJoined += (player) => {
    Debug.Log($"{player.Name} joined!");
};`,

  join: `// Join by lobby code
GrottoNetwork.JoinLobby("ABC123");

// Or join by selecting from list
GrottoNetwork.JoinLobby(selectedLobby);

// Called when successfully joined
GrottoNetwork.OnJoinedLobby += (lobby) => {
    Debug.Log($"Joined {lobby.Name}");
    SceneManager.LoadScene("GameScene");
};

// Called if join fails
GrottoNetwork.OnJoinFailed += (error) => {
    Debug.LogError($"Failed to join: {error}");
};`,

  list: `// Get list of public lobbies
var lobbies = await GrottoNetwork.GetLobbies();

foreach (var lobby in lobbies) {
    Debug.Log($"{lobby.Name} - {lobby.PlayerCount}/{lobby.MaxPlayers}");
}

// Refresh lobby list periodically
IEnumerator RefreshLobbies() {
    while (true) {
        lobbies = await GrottoNetwork.GetLobbies();
        UpdateLobbyUI(lobbies);
        yield return new WaitForSeconds(3f);
    }
}`
};

async function init() {
  await checkWallet();
  await loadServer();
  setupEventListeners();
  startPolling();
}

async function checkWallet() {
  const eth = window.avalanche || window.ethereum;
  if (!eth) return;

  try {
    const accounts = await eth.request({ method: 'eth_accounts' });
    if (accounts.length > 0) {
      walletAddress = accounts[0].toLowerCase();
    }
  } catch (e) {
    console.error('Wallet check failed:', e);
  }
}

async function loadServer() {
  try {
    const res = await fetch(`${API_URL}/api/servers/${serverId}`);
    const data = await res.json();

    if (!data.success) {
      alert('Server not found');
      window.location.href = '/servers';
      return;
    }

    server = data.server;
    isOwner = walletAddress && server.ownerId.toLowerCase() === walletAddress;

    updateUI();
    loadSettings();
    loadLobbies();

  } catch (e) {
    console.error('Failed to load server:', e);
  }
}

function updateUI() {
  $('server-name').textContent = server.name;
  $('status-badge').className = `status ${server.status}`;
  $('status-badge').textContent = server.status.toUpperCase();
  $('player-count').textContent = `${server.currentPlayers || 0}/${server.maxPlayers} players`;

  $('server-id').textContent = server.id;
  $('copy-server-id').textContent = server.id;
  $('server-address').textContent = server.address || 'Provisioning...';
  $('server-port').textContent = server.port || 7777;
  $('expires-date').textContent = formatDate(server.expiresAt);

  // API key (hidden by default)
  const apiKey = server.metadata?.apiKey || generateDisplayKey();
  $('api-key').textContent = apiKeyVisible ? apiKey : '••••••••••••';
  $('api-key').dataset.key = apiKey;

  if (!isOwner) {
    showOwnershipWarning();
  }
}

function showOwnershipWarning() {
  const warning = document.createElement('div');
  warning.className = 'ownership-warning';
  warning.innerHTML = 'Connect the wallet that owns this server to manage settings.';
  document.querySelector('.panel-header').appendChild(warning);

  // Disable inputs
  $$('input, button:not(.btn-copy)').forEach(el => {
    if (!el.classList.contains('btn-copy')) {
      el.disabled = true;
    }
  });
}

function loadSettings() {
  const settings = server.metadata?.settings || {};
  $('setting-name').value = server.name;
  $('setting-max-players').value = settings.maxPlayersPerLobby || 16;
  $('setting-max-lobbies').value = settings.maxLobbies || 10;
  $('setting-password').value = '';
  $('setting-public-lobbies').checked = settings.allowPublicLobbies !== false;
  $('setting-require-password').checked = settings.requireLobbyPasswords || false;
}

async function saveSettings() {
  if (!isOwner) return showToast('Not authorized', 'error');

  const settings = {
    name: $('setting-name').value.trim(),
    maxPlayersPerLobby: parseInt($('setting-max-players').value) || 16,
    maxLobbies: parseInt($('setting-max-lobbies').value) || 10,
    password: $('setting-password').value || null,
    allowPublicLobbies: $('setting-public-lobbies').checked,
    requireLobbyPasswords: $('setting-require-password').checked
  };

  try {
    const res = await fetch(`${API_URL}/api/servers/${serverId}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress, settings })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Settings saved!');
      loadServer();
    } else {
      showToast(data.error || 'Failed to save', 'error');
    }
  } catch (e) {
    showToast('Failed to save settings', 'error');
  }
}

async function loadLobbies() {
  try {
    const res = await fetch(`${API_URL}/api/servers/${serverId}/lobbies`);
    const data = await res.json();

    if (!data.success || !data.lobbies?.length) {
      $('lobbies-list').innerHTML = '<p class="empty-state">No active lobbies</p>';
      $('lobby-count').textContent = '0 active lobbies';
      return;
    }

    $('lobby-count').textContent = `${data.lobbies.length} active lobbies`;
    $('lobbies-list').innerHTML = data.lobbies.map(lobby => `
      <div class="lobby-item">
        <div class="lobby-info">
          <span class="lobby-name">${esc(lobby.name)}</span>
          <span class="lobby-code">${lobby.code}</span>
        </div>
        <div class="lobby-players">${lobby.playerCount}/${lobby.maxPlayers}</div>
        ${isOwner ? `<button class="btn-small btn-kick-lobby" data-lobby="${lobby.id}">Kick</button>` : ''}
      </div>
    `).join('');

    // Add kick handlers
    $$('.btn-kick-lobby').forEach(btn => {
      btn.onclick = () => kickLobby(btn.dataset.lobby);
    });

  } catch (e) {
    console.error('Failed to load lobbies:', e);
  }
}

async function kickLobby(lobbyId) {
  if (!isOwner) return;
  if (!confirm('Kick all players from this lobby?')) return;

  try {
    await fetch(`${API_URL}/api/servers/${serverId}/lobbies/${lobbyId}/kick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress })
    });
    showToast('Lobby kicked');
    loadLobbies();
  } catch (e) {
    showToast('Failed', 'error');
  }
}

async function kickAll() {
  if (!isOwner) return;
  if (!confirm('Kick ALL players from ALL lobbies?')) return;

  try {
    await fetch(`${API_URL}/api/servers/${serverId}/kick-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress })
    });
    showToast('All players kicked');
    loadLobbies();
  } catch (e) {
    showToast('Failed', 'error');
  }
}

async function regenerateKey() {
  if (!isOwner) return;
  if (!confirm('Regenerate API key? Your Unity projects will need the new key.')) return;

  try {
    const res = await fetch(`${API_URL}/api/servers/${serverId}/regenerate-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress })
    });
    const data = await res.json();
    if (data.success) {
      showToast('API key regenerated');
      apiKeyVisible = true;
      $('api-key').textContent = data.apiKey;
      $('api-key').dataset.key = data.apiKey;
    } else {
      showToast(data.error || 'Failed', 'error');
    }
  } catch (e) {
    showToast('Failed', 'error');
  }
}

function toggleKeyVisibility() {
  apiKeyVisible = !apiKeyVisible;
  const key = $('api-key').dataset.key;
  $('api-key').textContent = apiKeyVisible ? key : '••••••••••••';
  $('btn-show-key').textContent = apiKeyVisible ? 'Hide' : 'Show';
}

function showCodeSnippet(type) {
  $('code-preview').textContent = codeSnippets[type] || codeSnippets.host;
  $$('.code-tab').forEach(t => t.classList.toggle('active', t.dataset.code === type));
}

function copyToClipboard(elementId) {
  const el = $(elementId);
  const text = el.dataset.key || el.textContent;
  navigator.clipboard.writeText(text);
  showToast('Copied!');
}

function copyCode() {
  navigator.clipboard.writeText($('code-preview').textContent);
  showToast('Code copied!');
}

function startPolling() {
  pollInterval = setInterval(() => {
    loadLobbies();
  }, 10000);
}

function setupEventListeners() {
  $('btn-save-settings').onclick = saveSettings;
  $('btn-show-key').onclick = toggleKeyVisibility;
  $('btn-kick-all').onclick = kickAll;
  $('btn-regen-key').onclick = regenerateKey;

  $$('.btn-copy').forEach(btn => {
    btn.onclick = () => copyToClipboard(btn.dataset.copy);
  });

  $$('.code-tab').forEach(tab => {
    tab.onclick = () => showCodeSnippet(tab.dataset.code);
  });

  document.querySelector('.btn-copy-code').onclick = copyCode;

  $('btn-download-sdk')?.addEventListener('click', (e) => {
    e.preventDefault();
    showToast('SDK download coming soon!', 'info');
  });
}

// Helpers
function formatDate(ts) {
  if (!ts) return '--';
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

function generateDisplayKey() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return 'grotto_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

document.addEventListener('DOMContentLoaded', init);
