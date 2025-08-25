// Firefox/Chrome compatibility
const runtime = (typeof browser !== 'undefined') ? browser : chrome;

function getSpotifyInfo() {
  const info = { type: 'spotify' };
  const playerBar = document.querySelector('[data-testid="now-playing-bar"]');
  if (!playerBar) return {};

  // Better play state detection - try multiple selectors
  const pauseButton = playerBar.querySelector('button[data-testid="control-button-playpause"][aria-label*="Pause"]') ||
                     playerBar.querySelector('button[aria-label*="Pause"]') ||
                     playerBar.querySelector('[data-testid="control-button-playpause"] svg[aria-label*="Pause"]');
  
  const playButton = playerBar.querySelector('button[data-testid="control-button-playpause"][aria-label*="Play"]') ||
                    playerBar.querySelector('button[aria-label*="Play"]') ||
                    playerBar.querySelector('[data-testid="control-button-playpause"] svg[aria-label*="Play"]');

  info.isPlaying = !!pauseButton;

  const titleParts = document.title.split(' • ');
  if (titleParts.length >= 2 && !document.title.includes("Spotify")) {
    info.title = `${titleParts[0]} - ${titleParts[1]}`;
  }

  const image = playerBar.querySelector('a[href*="/album/"] img') || playerBar.querySelector('img[alt]');
  if (image) info.image = image.src;

  return info;
}

// --- NEW: Self-testing and Asynchronous YouTube Info Getter ---
function getYouTubeInfo() {
    // This function now returns a Promise, as it needs to test images asynchronously.
    return new Promise((resolve) => {
        const video = document.querySelector('video.html5-main-video');
        const videoId = new URLSearchParams(window.location.search).get('v');

        if (!video || !videoId) {
            resolve({}); // Resolve with nothing if not a valid video page
            return;
        }

        const baseInfo = {
            type: 'youtube',
            title: document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent || document.title,
            isPlaying: !video.paused,
            videoId: videoId
        };
        
        const fallbacks = [
            `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
            `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            `https://i.ytimg.com/vi/${videoId}/0.jpg`
        ];

        let fallbackIndex = 0;

        function testNextImage() {
            if (fallbackIndex >= fallbacks.length) {
                // If all fallbacks fail, resolve with no image.
                resolve({ ...baseInfo, image: null });
                return;
            }

            const currentUrl = fallbacks[fallbackIndex];
            const testImg = new Image();

            testImg.onload = function() {
                // If the loaded image is the 120x90 placeholder, reject it and try the next one.
                if (this.naturalWidth === 120 && this.naturalHeight === 90) {
                    fallbackIndex++;
                    testNextImage();
                } else {
                    // Success! We found a real image. Resolve the promise with the full info.
                    resolve({ ...baseInfo, image: currentUrl });
                }
            };
            
            testImg.onerror = function() {
                // If the image fails to load, try the next one.
                fallbackIndex++;
                testNextImage();
            };
            
            testImg.src = currentUrl;
        }
        
        testNextImage(); // Start the testing process.
    });
}

// sendUpdate is now an async function to handle the new getYouTubeInfo
async function sendUpdate() {
    let info = {};
    const hostname = window.location.hostname;

    if (hostname.includes("spotify")) {
        info = getSpotifyInfo();
    } else if (hostname.includes("youtube")) {
        info = await getYouTubeInfo(); // Wait for the image testing to complete
    }
    
    if (info && info.title) {
        runtime.runtime.sendMessage({ action: "updateInfo", info: { ...info, timestamp: Date.now() } }).catch(() => {});
    }
}

// Set up a regular interval to send updates
setInterval(sendUpdate, 1500);

// Set up observers for both platforms
if (window.location.hostname.includes("spotify")) {
    const playerBar = document.querySelector('[data-testid="now-playing-bar"]');
    if (playerBar) {
        const observer = new MutationObserver(() => {
            sendUpdate();
        });
        observer.observe(playerBar, {
            childList: true,
            subtree: true,
            attributes: true,
        });
    }
}

// Add YouTube event listeners
if (window.location.hostname.includes("youtube")) {
    const video = document.querySelector('video.html5-main-video');
    if (video) {
        ['play', 'pause', 'ended', 'timeupdate'].forEach(event => {
            video.addEventListener(event, sendUpdate);
        });
    }
}


// Listen for commands from the popup
runtime.runtime.onMessage.addListener((request) => {
  if (request.command) {
    if (window.location.hostname.includes("spotify")) {
        let button;
        if (request.command === 'playpause') {
            button = document.querySelector('[data-testid="control-button-playpause"][aria-label="Pause"], [data-testid="control-button-playpause"][aria-label="Play"]');
        } else if (request.command === 'rewind') {
            button = document.querySelector('[data-testid="control-button-skip-back"][aria-label="Previous"]');
        } else if (request.command === 'forward') {
            button = document.querySelector('[data-testid="control-button-skip-forward"][aria-label="Next"]');
        }
        if (button) button.click();
    } else if (window.location.hostname.includes("youtube")) {
        const video = document.querySelector('video.html5-main-video');
        if (video) {
            if (request.command === "playpause") video.paused ? video.play() : video.pause();
            if (request.command === "rewind") video.currentTime -= 10;
            if (request.command === "forward") video.currentTime += 10;
        }
    }
  }
});