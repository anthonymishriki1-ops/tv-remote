// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAgK1_-X-lvIotU1J1pgZi41--F2T_xBvk",
  authDomain: "tv-remote-67d43.firebaseapp.com",
  projectId: "tv-remote-67d43",
  storageBucket: "tv-remote-67d43.firebasestorage.app",
  messagingSenderId: "541664264018",
  appId: "1:541664264018:web:0dc72cd4a772c72c7a048b"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const PIN_KEY = 'tv-remote-pin';

// Storage helpers (works in both extension and webapp)
const hasChromeLocal = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

function getSavedPin() {
  return new Promise((resolve) => {
    if (hasChromeLocal) {
      chrome.storage.local.get(PIN_KEY, (r) => resolve(r[PIN_KEY] || null));
    } else {
      resolve(localStorage.getItem(PIN_KEY));
    }
  });
}

function savePin(pin) {
  if (hasChromeLocal) {
    chrome.storage.local.set({ [PIN_KEY]: pin });
  }
  localStorage.setItem(PIN_KEY, pin);
}

function clearPin() {
  if (hasChromeLocal) {
    chrome.storage.local.remove(PIN_KEY);
  }
  localStorage.removeItem(PIN_KEY);
}

// Generate 6-digit PIN
function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// DOM refs
const pairScreen = document.getElementById('pair-screen');
const remoteScreen = document.getElementById('remote-screen');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const createResult = document.getElementById('create-result');
const pinDisplay = document.getElementById('pin-display');
const joinForm = document.getElementById('join-form');
const pinInput = document.getElementById('pin-input');
const joinBtn = document.getElementById('join-btn');
const joinError = document.getElementById('join-error');
const roomPinLabel = document.getElementById('room-pin-label');
const unpairBtn = document.getElementById('unpair-btn');
const channelNameInput = document.getElementById('channel-name');
const channelLinkInput = document.getElementById('channel-link');
const addBtn = document.getElementById('add-btn');
const channelsGrid = document.getElementById('channels');
const emptyMsg = document.getElementById('empty-msg');

let unsubscribe = null; // Firestore listener

// Show/hide screens
function showPairScreen() {
  pairScreen.classList.remove('hidden');
  remoteScreen.classList.add('hidden');
  createResult.classList.add('hidden');
  joinForm.classList.add('hidden');
  joinError.classList.add('hidden');
}

function showRemoteScreen(pin) {
  pairScreen.classList.add('hidden');
  remoteScreen.classList.remove('hidden');
  roomPinLabel.textContent = 'PIN: ' + pin;
}

// Render channels
function render(channels) {
  channelsGrid.innerHTML = '';

  if (!channels || channels.length === 0) {
    emptyMsg.classList.remove('hidden');
    return;
  }

  emptyMsg.classList.add('hidden');

  channels.forEach((ch, i) => {
    const btn = document.createElement('a');
    btn.className = 'channel-btn';
    btn.href = ch.link;
    btn.target = '_blank';
    btn.rel = 'noopener';
    btn.title = ch.link;

    if (ch.thumb) {
      const img = document.createElement('img');
      img.src = ch.thumb;
      img.alt = ch.name;
      img.className = 'channel-thumb';
      btn.appendChild(img);
    }

    const nameSpan = document.createElement('span');
    nameSpan.className = 'channel-name';
    nameSpan.textContent = ch.name;
    btn.appendChild(nameSpan);

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '\u00d7';
    del.title = 'Remove';
    del.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      channels.splice(i, 1);
      await updateChannels(channels);
    });
    btn.appendChild(del);

    channelsGrid.appendChild(btn);
  });
}

// Firestore operations
let currentPin = null;

function roomRef(pin) {
  return db.collection('rooms').doc(pin);
}

async function updateChannels(channels) {
  if (!currentPin) return;
  await roomRef(currentPin).set({ channels, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
}

function listenToRoom(pin) {
  if (unsubscribe) unsubscribe();

  unsubscribe = roomRef(pin).onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      render(data.channels || []);
    } else {
      render([]);
    }
  });
}

// Create room
async function createRoom() {
  const pin = generatePin();

  // Check if PIN already exists (unlikely but safe)
  const doc = await roomRef(pin).get();
  if (doc.exists) {
    return createRoom(); // retry
  }

  await roomRef(pin).set({
    channels: [],
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  currentPin = pin;
  savePin(pin);
  pinDisplay.textContent = pin;
  createResult.classList.remove('hidden');
  joinForm.classList.add('hidden');

  // Auto-connect after short delay
  setTimeout(() => {
    showRemoteScreen(pin);
    listenToRoom(pin);
  }, 1500);
}

// Join room
async function joinRoom() {
  const pin = pinInput.value.trim();

  if (pin.length !== 6 || !/^\d+$/.test(pin)) {
    joinError.textContent = 'Enter a valid 6-digit PIN';
    joinError.classList.remove('hidden');
    return;
  }

  const doc = await roomRef(pin).get();
  if (!doc.exists) {
    joinError.textContent = 'Room not found. Check the PIN.';
    joinError.classList.remove('hidden');
    return;
  }

  currentPin = pin;
  savePin(pin);
  showRemoteScreen(pin);
  listenToRoom(pin);
}

// Unpair
function unpair() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  currentPin = null;
  clearPin();
  showPairScreen();
}

// Add channel
function normalizeUrl(url) {
  url = url.trim();
  if (url && !/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

async function addChannel() {
  const name = channelNameInput.value.trim();
  const link = normalizeUrl(channelLinkInput.value);

  if (!name || !link) return;

  const doc = await roomRef(currentPin).get();
  const channels = doc.exists ? (doc.data().channels || []) : [];
  channels.push({ name, link, thumb: '' });
  await updateChannels(channels);

  channelNameInput.value = '';
  channelLinkInput.value = '';
  channelNameInput.focus();
}

// Event listeners
createRoomBtn.addEventListener('click', () => {
  joinForm.classList.add('hidden');
  createRoom();
});

joinRoomBtn.addEventListener('click', () => {
  createResult.classList.add('hidden');
  joinForm.classList.remove('hidden');
  joinError.classList.add('hidden');
  pinInput.value = '';
  pinInput.focus();
});

joinBtn.addEventListener('click', joinRoom);
pinInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinRoom();
});

unpairBtn.addEventListener('click', unpair);
addBtn.addEventListener('click', addChannel);
channelNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addChannel();
});
channelLinkInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addChannel();
});

// Remote control buttons — send messages to active tab's content script
function sendToActiveTab(action) {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      // Skip the extension popup tab itself
      const tab = tabs.find(t => !t.url.startsWith('chrome-extension://'));
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action });
      }
    });
  }
}

document.getElementById('vol-up').addEventListener('click', () => sendToActiveTab('vol-up'));
document.getElementById('vol-down').addEventListener('click', () => sendToActiveTab('vol-down'));
document.getElementById('mute-btn').addEventListener('click', () => sendToActiveTab('mute'));
document.getElementById('play-pause-btn').addEventListener('click', () => sendToActiveTab('play-pause'));
document.getElementById('fullscreen-btn').addEventListener('click', () => sendToActiveTab('fullscreen'));

// Expose for thumbnail updates
window.tvRemote = {
  async getChannels() {
    if (!currentPin) return [];
    const doc = await roomRef(currentPin).get();
    return doc.exists ? (doc.data().channels || []) : [];
  },
  async setThumb(index, thumbUrl) {
    const channels = await this.getChannels();
    if (index >= 0 && index < channels.length) {
      channels[index].thumb = thumbUrl;
      await updateChannels(channels);
    }
  }
};

// Init — check for saved PIN
async function init() {
  const savedPin = await getSavedPin();

  if (savedPin) {
    // Verify room still exists
    const doc = await roomRef(savedPin).get();
    if (doc.exists) {
      currentPin = savedPin;
      showRemoteScreen(savedPin);
      listenToRoom(savedPin);
      return;
    }
    // Room gone, clear saved pin
    clearPin();
  }

  showPairScreen();
}

init();
