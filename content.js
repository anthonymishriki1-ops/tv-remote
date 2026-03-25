// Content script: auto-play and fullscreen videos on streaming sites
(function () {
  let attempts = 0;
  const maxAttempts = 30; // try for 15 seconds

  function tryAutoPlay() {
    const videos = document.querySelectorAll('video');

    for (const video of videos) {
      // Skip tiny/hidden videos (ads, thumbnails)
      if (video.offsetWidth < 200 || video.offsetHeight < 100) continue;

      // Play if paused
      if (video.paused) {
        video.muted = true; // browsers require muted for autoplay
        video.play().then(() => {
          // Unmute after play starts
          setTimeout(() => { video.muted = false; }, 500);
        }).catch(() => {});
      }

      // Request fullscreen on the video or its container
      const container = video.closest('[class*="player"]') || video.parentElement || video;
      if (!document.fullscreenElement) {
        container.requestFullscreen().catch(() => {
          // Try the video itself
          video.requestFullscreen().catch(() => {});
        });
      }

      return true; // found a video
    }

    return false;
  }

  // Also look for play buttons and click them
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
    if (!found) {
      tryClickPlay();
    }

    if (!found && attempts <= maxAttempts) {
      setTimeout(poll, 500);
    }
  }

  // Wait for page to settle before trying
  if (document.readyState === 'complete') {
    setTimeout(poll, 1500);
  } else {
    window.addEventListener('load', () => setTimeout(poll, 1500));
  }
})();
