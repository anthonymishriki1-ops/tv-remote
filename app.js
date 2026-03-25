const STORAGE_KEY = 'tv-remote-channels';

const hasChromeSync = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync;

function loadChannels() {
  return new Promise((resolve) => {
    if (hasChromeSync) {
      // Extension: prefer chrome.storage.sync as source of truth
      chrome.storage.sync.get(STORAGE_KEY, (result) => {
        const channels = result[STORAGE_KEY] || [];
        // Also mirror to localStorage for webapp access
        localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
        resolve(channels);
      });
    } else {
      const data = localStorage.getItem(STORAGE_KEY);
      resolve(data ? JSON.parse(data) : []);
    }
  });
}

function saveChannels(channels) {
  // Always save to localStorage
  localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));

  return new Promise((resolve) => {
    if (hasChromeSync) {
      // Also save to chrome.storage.sync
      chrome.storage.sync.set({ [STORAGE_KEY]: channels }, resolve);
    } else {
      resolve();
    }
  });
}

let currentChannels = [];

function render(channels) {
  currentChannels = channels;
  const grid = document.getElementById('channels');
  const emptyMsg = document.getElementById('empty-msg');

  grid.innerHTML = '';

  if (channels.length === 0) {
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

    // Thumbnail
    if (ch.thumb) {
      const img = document.createElement('img');
      img.src = ch.thumb;
      img.alt = ch.name;
      img.className = 'channel-thumb';
      btn.appendChild(img);
    }

    // Name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'channel-name';
    nameSpan.textContent = ch.name;
    btn.appendChild(nameSpan);

    // Delete button
    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '\u00d7';
    del.title = 'Remove';
    del.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      channels.splice(i, 1);
      await saveChannels(channels);
      render(channels);
    });
    btn.appendChild(del);

    grid.appendChild(btn);
  });
}

function normalizeUrl(url) {
  url = url.trim();
  if (url && !/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

async function init() {
  const channels = await loadChannels();
  render(channels);

  const nameInput = document.getElementById('channel-name');
  const linkInput = document.getElementById('channel-link');
  const addBtn = document.getElementById('add-btn');

  async function addChannel() {
    const name = nameInput.value.trim();
    const link = normalizeUrl(linkInput.value);

    if (!name || !link) return;

    channels.push({ name, link, thumb: '' });
    await saveChannels(channels);
    render(channels);

    nameInput.value = '';
    linkInput.value = '';
    nameInput.focus();
  }

  addBtn.addEventListener('click', addChannel);

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addChannel();
  });
  linkInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addChannel();
  });

  // Listen for changes from the other side (extension <-> webapp)
  if (hasChromeSync) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes[STORAGE_KEY]) {
        const updated = changes[STORAGE_KEY].newValue || [];
        render(updated);
      }
    });
  }

  // Webapp: poll localStorage for changes from extension
  if (!hasChromeSync) {
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) {
        const updated = e.newValue ? JSON.parse(e.newValue) : [];
        render(updated);
      }
    });
  }
}

// Expose for external thumbnail updates
window.tvRemote = {
  async getChannels() {
    return loadChannels();
  },
  async updateChannel(index, updates) {
    const channels = await loadChannels();
    if (index >= 0 && index < channels.length) {
      Object.assign(channels[index], updates);
      await saveChannels(channels);
      render(channels);
    }
  },
  async setThumb(index, thumbUrl) {
    return this.updateChannel(index, { thumb: thumbUrl });
  }
};

init();
