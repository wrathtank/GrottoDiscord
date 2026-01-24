// Grotto Server Panel - Server Management Interface

const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://grotto-discord-bot-7dcd8c6451fc.herokuapp.com';

// Get server ID from URL
const urlParams = new URLSearchParams(window.location.search);
const serverId = urlParams.get('server');

if (!serverId) {
  alert('No server specified');
  window.location.href = '/servers';
}

// State
let server = null;
let walletAddress = null;
let isOwner = false;
let logInterval = null;
let config = {
  executable: '',
  port: 7777,
  maxPlayers: 32,
  args: '-batchmode -nographics',
  autoStart: true,
  env: {}
};

// DOM helpers
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// Initialize
async function init() {
  // Check wallet connection
  await checkWallet();

  // Load server data
  await loadServer();

  // Setup tabs
  setupTabs();

  // Setup event listeners
  setupEventListeners();

  // Start log polling if on logs tab
  if (document.querySelector('.tab.active').dataset.tab === 'logs') {
    startLogPolling();
  }
}

// Wallet check
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

// Load server data
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

    // Check ownership
    if (walletAddress && server.ownerId.toLowerCase() === walletAddress) {
      isOwner = true;
      enableControls();
    } else {
      disableControls();
    }

    updateUI();
    loadConfig();

  } catch (e) {
    console.error('Failed to load server:', e);
    alert('Failed to load server');
  }
}

// Update UI with server data
function updateUI() {
  // Header
  $('server-name').textContent = server.name;
  $('status-badge').className = `status ${server.status}`;
  $('status-badge').textContent = server.status.toUpperCase();
  $('player-count').textContent = `${server.currentPlayers}/${server.maxPlayers} players`;

  // Connection info
  const addr = server.address || 'Provisioning...';
  const port = server.port || 7777;
  $('conn-address').textContent = addr;
  $('conn-port').textContent = port;
  $('conn-full').textContent = `${addr}:${port}`;

  // Unity snippet
  $('unity-snippet').textContent = `// Add to your NetworkManager or connection script
NetworkManager.singleton.networkAddress = "${addr}";
// For Mirror/Netcode, use your transport's port setting
// Default port: ${port}
NetworkManager.singleton.StartClient();`;

  // Info tab
  $('info-id').textContent = server.id;
  $('info-game').textContent = server.gameName;
  $('info-status').textContent = server.status;
  $('info-ip').textContent = server.address || 'Pending';
  $('info-created').textContent = formatDate(server.createdAt);
  $('info-expires').textContent = formatDate(server.expiresAt);

  // Button states
  updateButtonStates();
}

function updateButtonStates() {
  const isOnline = server.status === 'online';
  const isOffline = server.status === 'offline';
  const isProvisioning = server.status === 'provisioning';

  $('btn-start').disabled = !isOwner || isOnline || isProvisioning;
  $('btn-stop').disabled = !isOwner || isOffline || isProvisioning;
  $('btn-restart').disabled = !isOwner || isOffline || isProvisioning;
}

function enableControls() {
  $$('.btn-action, .btn-fire, .btn-danger, input, select').forEach(el => {
    el.classList.remove('disabled');
  });
}

function disableControls() {
  $$('.btn-action').forEach(el => el.disabled = true);
  // Show ownership message
  const msg = document.createElement('div');
  msg.className = 'ownership-warning';
  msg.innerHTML = 'Connect the wallet that owns this server to manage it.';
  document.querySelector('.quick-actions').prepend(msg);
}

// Tabs
function setupTabs() {
  $$('.tab').forEach(tab => {
    tab.onclick = () => switchTab(tab.dataset.tab);
  });
}

function switchTab(tabId) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  $$('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === 'tab-' + tabId);
    c.classList.toggle('hidden', c.id !== 'tab-' + tabId);
  });

  // Start/stop log polling
  if (tabId === 'logs') {
    startLogPolling();
  } else {
    stopLogPolling();
  }
}

// Server Control
async function serverAction(action) {
  if (!isOwner) return alert('Not authorized');

  const btn = $(`btn-${action}`);
  btn.disabled = true;
  btn.innerHTML = `<span class="icon">&#8987;</span> ${action.toUpperCase()}ING...`;

  try {
    const res = await fetch(`${API_URL}/api/servers/${serverId}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, wallet: walletAddress })
    });

    const data = await res.json();

    if (data.success) {
      showToast(`Server ${action} initiated`);
      setTimeout(loadServer, 2000);
    } else {
      showToast(data.error || 'Action failed', 'error');
    }
  } catch (e) {
    showToast('Action failed', 'error');
  } finally {
    setTimeout(() => loadServer(), 1000);
  }
}

// File Upload
function setupUpload() {
  const zone = $('upload-zone');
  const input = $('file-input');

  // Drag & drop
  zone.ondragover = e => { e.preventDefault(); zone.classList.add('dragover'); };
  zone.ondragleave = () => zone.classList.remove('dragover');
  zone.ondrop = e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  // File input
  input.onchange = () => {
    if (input.files[0]) uploadFile(input.files[0]);
  };
}

async function uploadFile(file) {
  if (!isOwner) return alert('Not authorized');
  if (!file.name.endsWith('.zip')) return alert('Please upload a .zip file');
  if (file.size > 500 * 1024 * 1024) return alert('File too large (max 500MB)');

  const progress = $('upload-progress');
  const fill = $('progress-fill');
  const text = $('progress-text');

  progress.classList.remove('hidden');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('wallet', walletAddress);

  try {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        fill.style.width = pct + '%';
        text.textContent = pct + '%';
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        if (data.success) {
          showToast('Upload complete! Extracting...');
          loadGameInfo();
          if (config.autoStart) {
            setTimeout(() => serverAction('start'), 3000);
          }
        } else {
          showToast(data.error || 'Upload failed', 'error');
        }
      } else {
        showToast('Upload failed', 'error');
      }
      progress.classList.add('hidden');
      fill.style.width = '0%';
    };

    xhr.onerror = () => {
      showToast('Upload failed', 'error');
      progress.classList.add('hidden');
    };

    xhr.open('POST', `${API_URL}/api/servers/${serverId}/upload`);
    xhr.send(formData);

  } catch (e) {
    showToast('Upload failed', 'error');
    progress.classList.add('hidden');
  }
}

async function loadGameInfo() {
  try {
    const res = await fetch(`${API_URL}/api/servers/${serverId}/game?wallet=${walletAddress}`);
    const data = await res.json();

    if (data.success && data.game) {
      $('current-game').classList.remove('hidden');
      $('game-filename').textContent = data.game.filename;
      $('game-size').textContent = formatSize(data.game.size);
      $('game-uploaded').textContent = 'Uploaded: ' + formatDate(data.game.uploadedAt);
    } else {
      $('current-game').classList.add('hidden');
    }
  } catch (e) {
    console.error('Failed to load game info:', e);
  }
}

async function deleteGame() {
  if (!confirm('Delete uploaded game? Server will be stopped.')) return;

  try {
    const res = await fetch(`${API_URL}/api/servers/${serverId}/game`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Game deleted');
      $('current-game').classList.add('hidden');
      loadServer();
    } else {
      showToast(data.error || 'Failed', 'error');
    }
  } catch (e) {
    showToast('Failed to delete', 'error');
  }
}

// Config
function loadConfig() {
  // Load from server metadata if available
  if (server.metadata?.config) {
    config = { ...config, ...server.metadata.config };
  }

  $('cfg-executable').value = config.executable;
  $('cfg-port').value = config.port;
  $('cfg-maxplayers').value = config.maxPlayers;
  $('cfg-args').value = config.args;
  $('cfg-autostart').checked = config.autoStart;

  renderEnvVars();
}

async function saveConfig() {
  if (!isOwner) return alert('Not authorized');

  config.executable = $('cfg-executable').value;
  config.port = parseInt($('cfg-port').value) || 7777;
  config.maxPlayers = parseInt($('cfg-maxplayers').value) || 32;
  config.args = $('cfg-args').value;
  config.autoStart = $('cfg-autostart').checked;

  // Collect env vars
  config.env = {};
  $$('.env-row').forEach(row => {
    const key = row.querySelector('.env-key').value.trim();
    const val = row.querySelector('.env-val').value;
    if (key) config.env[key] = val;
  });

  try {
    const res = await fetch(`${API_URL}/api/servers/${serverId}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress, config })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Config saved');
    } else {
      showToast(data.error || 'Failed', 'error');
    }
  } catch (e) {
    showToast('Failed to save', 'error');
  }
}

function renderEnvVars() {
  const list = $('env-list');
  list.innerHTML = '';

  Object.entries(config.env || {}).forEach(([key, val]) => {
    addEnvRow(key, val);
  });
}

function addEnvRow(key = '', val = '') {
  const row = document.createElement('div');
  row.className = 'env-row';
  row.innerHTML = `
    <input type="text" class="env-key" placeholder="KEY" value="${key}">
    <input type="text" class="env-val" placeholder="value" value="${val}">
    <button class="btn-remove" onclick="this.parentElement.remove()">&times;</button>
  `;
  $('env-list').appendChild(row);
}

// Logs
function startLogPolling() {
  if (logInterval) return;
  fetchLogs();
  logInterval = setInterval(fetchLogs, 3000);
}

function stopLogPolling() {
  if (logInterval) {
    clearInterval(logInterval);
    logInterval = null;
  }
}

async function fetchLogs() {
  try {
    const res = await fetch(`${API_URL}/api/servers/${serverId}/logs?wallet=${walletAddress}&lines=200`);
    const data = await res.json();

    if (data.success && data.logs) {
      renderLogs(data.logs);
    }
  } catch (e) {
    console.error('Failed to fetch logs:', e);
  }
}

function renderLogs(logs) {
  const output = $('log-output');
  const shouldScroll = $('log-autoscroll').checked;

  if (!logs || logs.length === 0) {
    output.innerHTML = '<div class="log-empty">No logs yet. Start your server to see output.</div>';
    return;
  }

  output.innerHTML = logs.map(line => {
    const cls = line.includes('ERROR') ? 'log-error' :
                line.includes('WARN') ? 'log-warn' :
                line.includes('[INFO]') ? 'log-info' : '';
    return `<div class="log-line ${cls}">${escapeHtml(line)}</div>`;
  }).join('');

  if (shouldScroll) {
    output.scrollTop = output.scrollHeight;
  }
}

function clearLogs() {
  $('log-output').innerHTML = '<div class="log-empty">Logs cleared.</div>';
}

function downloadLogs() {
  const content = $('log-output').innerText;
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${serverId}-logs.txt`;
  a.click();
}

// Factory Reset
async function factoryReset() {
  if (!confirm('This will delete ALL game files and reset the server. Continue?')) return;
  if (!confirm('Are you REALLY sure? This cannot be undone.')) return;

  try {
    const res = await fetch(`${API_URL}/api/servers/${serverId}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: walletAddress })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Factory reset complete');
      loadServer();
      loadGameInfo();
    } else {
      showToast(data.error || 'Reset failed', 'error');
    }
  } catch (e) {
    showToast('Reset failed', 'error');
  }
}

// Helpers
function formatDate(ts) {
  if (!ts) return '--';
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function copyToClipboard(id) {
  const text = $(id).textContent;
  navigator.clipboard.writeText(text);
  showToast('Copied!');
}

function copyCode() {
  const code = $('unity-snippet').textContent;
  navigator.clipboard.writeText(code);
  showToast('Code copied!');
}

function showToast(msg, type = 'success') {
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

// Event Listeners
function setupEventListeners() {
  $('btn-start').onclick = () => serverAction('start');
  $('btn-stop').onclick = () => serverAction('stop');
  $('btn-restart').onclick = () => serverAction('restart');

  $('btn-save-config').onclick = saveConfig;
  $('btn-add-env').onclick = () => addEnvRow();

  $('btn-clear-logs').onclick = clearLogs;
  $('btn-download-logs').onclick = downloadLogs;

  $('btn-delete-game').onclick = deleteGame;
  $('btn-factory-reset').onclick = factoryReset;

  setupUpload();
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
