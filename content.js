// Content script: auto-play, fullscreen, and remote controls for streaming sites
(function () {
  // ── Auto-play & fullscreen on page load ──
  let attempts = 0;
  const maxAttempts = 30;

  function getMainVideo() {
    const videos = document.querySelectorAll('video');
    for (const video of videos) {
      if (video.offsetWidth < 200 || video.offsetHeight < 100) continue;
      return video;
    }
    return videos[0] || null;
  }

  function tryAutoPlay() {
    const video = getMainVideo();
    if (!video) return false;

    if (video.paused) {
      video.muted = true;
      video.play().then(() => {
        setTimeout(() => { video.muted = false; }, 500);
      }).catch(() => {});
    }

    const container = video.closest('[class*="player"]') || video.parentElement || video;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {
        video.requestFullscreen().catch(() => {});
      });
    }

    return true;
  }

  function tryClickPlay() {
    const playSelectors = [
      'button[aria-label*="Play"]',
      'button[aria-label*="play"]',
      'button[title*="Play"]',
      'button[title*="play"]',
      '[class*="play-button"]',
      '[class*="playButton"]',
      '[class*="play_button"]',
      '[data-testid*="play"]',
    ];

    for (const sel of playSelectors) {
      const btn = document.querySelector(sel);
      if (btn) {
        btn.click();
        return true;
      }
    }
    return false;
  }

  function poll() {
    attempts++;
    if (attempts > maxAttempts) return;

    const found = tryAutoPlay();
    if (!found) tryClickPlay();
    if (!found && attempts <= maxAttempts) setTimeout(poll, 500);
  }

  if (document.readyState === 'complete') {
    setTimeout(poll, 1500);
  } else {
    window.addEventListener('load', () => setTimeout(poll, 1500));
  }

  // ── Listen for remote control messages ──
  chrome.runtime.onMessage.addListener((msg) => {
    const video = getMainVideo();
    if (!video) return;

    switch (msg.action) {
      case 'vol-up':
        video.volume = Math.min(1, video.volume + 0.1);
        break;

      case 'vol-down':
        video.volume = Math.max(0, video.volume - 0.1);
        break;

      case 'mute':
        video.muted = !video.muted;
        break;

      case 'play-pause':
        if (video.paused) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
        break;

      case 'fullscreen':
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          const container = video.closest('[class*="player"]') || video.parentElement || video;
          container.requestFullscreen().catch(() => {
            video.requestFullscreen().catch(() => {});
          });
        }
        break;
    }
  });
})();
