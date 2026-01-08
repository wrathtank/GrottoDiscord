// The Grotto - Wallet Verification
// Automatic verification flow

let provider = null;
let signer = null;
let walletAddress = null;
let signature = null;

// Get verification params from URL
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');
const nonce = urlParams.get('nonce') || generateNonce();
const timestamp = urlParams.get('timestamp') || Date.now();
let apiUrl = urlParams.get('api') || '';

// Decode API URL if it was encoded
if (apiUrl) {
  try {
    apiUrl = decodeURIComponent(apiUrl);
  } catch (e) {
    console.log('API URL already decoded');
  }
}

// Debug logging
console.log('Verification params:', { sessionId, nonce, timestamp, apiUrl });

function generateNonce() {
  return Math.random().toString(36).substring(2, 18);
}

// Generate the message to sign (must match the bot's format)
function generateMessage() {
  return `Sign this message to verify your wallet ownership for The Grotto Discord.

Nonce: ${nonce}
Timestamp: ${timestamp}`;
}

// DOM Elements
const stepConnect = document.getElementById('step-connect');
const stepSign = document.getElementById('step-sign');
const stepVerifying = document.getElementById('step-verifying');
const stepSuccess = document.getElementById('step-success');
const stepError = document.getElementById('step-error');

const btnConnect = document.getElementById('btn-connect');
const btnSign = document.getElementById('btn-sign');
const btnRetry = document.getElementById('btn-retry');

const signMessage = document.getElementById('sign-message');
const verifiedWallet = document.getElementById('verified-wallet');
const rolesAssigned = document.getElementById('roles-assigned');
const errorMessage = document.getElementById('error-message');
const walletInfo = document.getElementById('wallet-info');
const walletAddressDisplay = document.getElementById('wallet-address');

// Show step
function showStep(step) {
  [stepConnect, stepSign, stepVerifying, stepSuccess, stepError].forEach(s => {
    if (s) s.classList.remove('active');
  });
  if (step) step.classList.add('active');
}

// Show error
function showError(message) {
  console.error('Error:', message);
  errorMessage.textContent = message;
  showStep(stepError);
}

// Format address
function formatAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Check for wallet availability
function hasWallet() {
  return typeof window.ethereum !== 'undefined' ||
         typeof window.web3 !== 'undefined';
}

// Connect wallet
async function connectWallet() {
  try {
    // Check for wallet
    if (!hasWallet()) {
      // On mobile, might need to open in wallet browser
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        showError('Please open this page in your wallet app browser (MetaMask, Trust Wallet, etc.)');
      } else {
        showError('No wallet detected! Please install MetaMask or another Web3 wallet.');
      }
      return;
    }

    btnConnect.innerHTML = '<span>CONNECTING...</span>';

    // Get ethereum provider
    const ethereum = window.ethereum || window.web3?.currentProvider;

    // Request accounts
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned');
    }

    walletAddress = accounts[0];
    console.log('Connected wallet:', walletAddress);

    // Create provider and signer
    provider = new ethers.providers.Web3Provider(ethereum);
    signer = provider.getSigner();

    // Update UI
    walletAddressDisplay.textContent = formatAddress(walletAddress);
    walletInfo.classList.remove('hidden');

    // Show message to sign
    signMessage.textContent = generateMessage();
    showStep(stepSign);

  } catch (error) {
    console.error('Connection error:', error);
    btnConnect.innerHTML = '<span>CONNECT WALLET</span>';
    if (error.code === 4001) {
      showError('Connection rejected. Please approve the connection request.');
    } else if (error.message) {
      showError(`Connection failed: ${error.message}`);
    } else {
      showError('Failed to connect wallet. Please try again.');
    }
  }
}

// Sign message and verify
async function signMessageWithWallet() {
  try {
    btnSign.innerHTML = '<span>SIGNING...</span>';

    const message = generateMessage();
    console.log('Signing message:', message);

    signature = await signer.signMessage(message);
    console.log('Got signature:', signature.slice(0, 20) + '...');

    // Show verifying step
    showStep(stepVerifying);

    // Send to API for automatic verification
    await submitVerification();

  } catch (error) {
    console.error('Signing error:', error);
    btnSign.innerHTML = '<span>SIGN MESSAGE</span>';
    if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
      showError('Signature rejected. Please approve the signature request.');
    } else if (error.message) {
      showError(`Signing failed: ${error.message}`);
    } else {
      showError('Failed to sign message. Please try again.');
    }
  }
}

// Submit verification to bot API
async function submitVerification() {
  try {
    if (!apiUrl || !sessionId) {
      console.log('No API URL or session ID, showing manual fallback');
      showManualFallback('No API URL configured. Please use manual verification.');
      return;
    }

    console.log('Submitting verification to:', apiUrl);

    const response = await fetch(`${apiUrl}/api/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        walletAddress,
        signature,
        nonce,
        timestamp: parseInt(timestamp),
      }),
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error('Response error:', text);
      try {
        const data = JSON.parse(text);
        showError(data.error || `Server error: ${response.status}`);
      } catch {
        showError(`Server error: ${response.status}`);
      }
      return;
    }

    const data = await response.json();
    console.log('Response data:', data);

    if (data.success) {
      // Success!
      verifiedWallet.textContent = data.walletAddress || formatAddress(walletAddress);

      if (data.rolesAssigned && data.rolesAssigned.length > 0) {
        rolesAssigned.innerHTML = '<strong>Roles assigned:</strong><br>' +
          data.rolesAssigned.map(r => `• ${r}`).join('<br>');
      } else {
        rolesAssigned.innerHTML = 'Wallet linked! Check Discord for role updates.';
      }

      showStep(stepSuccess);
    } else {
      showError(data.error || 'Verification failed. Please try again.');
    }

  } catch (error) {
    console.error('API error:', error);
    // Show manual fallback on network error
    showManualFallback(`Could not connect to server: ${error.message}`);
  }
}

// Show manual fallback when API fails
function showManualFallback(reason) {
  verifiedWallet.textContent = formatAddress(walletAddress);
  rolesAssigned.innerHTML = `
    <p style="color: #ff6600;">${reason || 'Could not connect to bot automatically.'}</p>
    <p>Copy this signature and paste it in Discord using the Manual Entry button:</p>
    <textarea id="signature-output" readonly style="width:100%;height:60px;margin:10px 0;background:#1a1a1a;color:#fff;border:1px solid #ff0033;padding:8px;font-size:11px;">${signature}</textarea>
    <button onclick="copySignature()" class="btn-secondary" style="margin-top:5px;">COPY SIGNATURE</button>
    <p style="font-size:0.5rem;margin-top:10px;color:#888;">Wallet: ${walletAddress}</p>
  `;
  showStep(stepSuccess);
}

// Copy signature fallback
function copySignature() {
  const textarea = document.getElementById('signature-output');
  if (textarea) {
    textarea.select();
    textarea.setSelectionRange(0, 99999); // For mobile
    document.execCommand('copy');
    event.target.textContent = 'COPIED!';
    setTimeout(() => {
      event.target.textContent = 'COPY SIGNATURE';
    }, 2000);
  }
}

// Retry
function retry() {
  btnConnect.innerHTML = '<span>CONNECT WALLET</span>';
  btnSign.innerHTML = '<span>SIGN MESSAGE</span>';
  showStep(stepConnect);
}

// Event listeners
btnConnect.addEventListener('click', connectWallet);
btnSign.addEventListener('click', signMessageWithWallet);
btnRetry.addEventListener('click', retry);

// Listen for account changes
if (window.ethereum) {
  window.ethereum.on('accountsChanged', (accounts) => {
    if (accounts.length === 0) {
      walletInfo.classList.add('hidden');
      showStep(stepConnect);
    } else {
      walletAddress = accounts[0];
      walletAddressDisplay.textContent = formatAddress(walletAddress);
    }
  });
}

// Check if we have valid session params - but don't block if missing
if (!sessionId) {
  console.warn('No session ID in URL - manual fallback will be used');
}

// ============================================
// VISUAL EFFECTS
// ============================================

// Custom fire cursor
const cursor = document.getElementById('cursor');
const cursorTrail = document.getElementById('cursor-trail');
let mouseX = 0, mouseY = 0;
let cursorX = 0, cursorY = 0;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

function animateCursor() {
  // Smooth follow
  cursorX += (mouseX - cursorX) * 0.15;
  cursorY += (mouseY - cursorY) * 0.15;

  cursor.style.left = cursorX + 'px';
  cursor.style.top = cursorY + 'px';

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

// Glitch effect on hover for buttons
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
    setTimeout(() => {
      document.body.style.opacity = '1';
    }, 50);
  }
  requestAnimationFrame(screenFlicker);
}
screenFlicker();

// Add some random glitch to the title
const glitchText = document.querySelector('.glitch-text');
if (glitchText) {
  setInterval(() => {
    if (Math.random() > 0.95) {
      glitchText.style.transform = `translate(${(Math.random() - 0.5) * 5}px, ${(Math.random() - 0.5) * 5}px)`;
      setTimeout(() => {
        glitchText.style.transform = '';
      }, 100);
    }
  }, 100);
}

console.log('%c🔥 THE GROTTO 🔥', 'color: #ff0033; font-size: 30px; font-weight: bold; text-shadow: 0 0 10px #ff0033;');
console.log('%cWallet Verification System', 'color: #888; font-size: 14px;');
