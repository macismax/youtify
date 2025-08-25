// Firefox/Chrome compatibility
const runtime = (typeof browser !== 'undefined') ? browser : chrome;

document.addEventListener("DOMContentLoaded", () => {
    const artwork = document.getElementById("artwork");
    const titleText = document.getElementById('title-text');
    const playPauseBtn = document.getElementById("playpause");

    // --- RESTORED: YouTube Image Fallback System ---
    function tryYouTubeFallbacks(videoId, fallbackIndex = 0) {
        // A list of thumbnail qualities to try, from best to worst.
        const fallbacks = [
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
            `https://i.ytimg.com/vi/${videoId}/0.jpg`
        ];

        if (fallbackIndex >= fallbacks.length) {
            artwork.style.display = 'none'; // Hide if all fallbacks fail
            return;
        }
        
        artwork.src = fallbacks[fallbackIndex];
        // If this image also fails, the onerror will call this function again
        // to try the next one in the list.
        artwork.onerror = () => tryYouTubeFallbacks(videoId, fallbackIndex + 1);
    }

    function updateUI() {
        runtime.runtime.sendMessage({ action: "getInfo" }).then(mediaInfo => {
            if (mediaInfo && mediaInfo.title) {
                titleText.textContent = mediaInfo.title;
                playPauseBtn.textContent = mediaInfo.isPlaying ? "⏸" : "▶";

                if (mediaInfo.image) {
                    const newBaseUrl = mediaInfo.image.split('?')[0];
                    const currentBaseUrl = artwork.src.split('?')[0];

                    // Only update if the base URL has changed
                    if (currentBaseUrl !== newBaseUrl) {
                        artwork.src = mediaInfo.image;
                    }
                    
                    artwork.style.display = 'block';
                    document.body.style.backgroundImage = `url('${artwork.src}')`;

                    // If the primary image fails, start the fallback process for YouTube.
                    artwork.onerror = () => {
                        if (mediaInfo.type === 'youtube' && mediaInfo.videoId) {
                            tryYouTubeFallbacks(mediaInfo.videoId);
                        } else {
                            artwork.style.display = 'none';
                        }
                    };

                } else {
                    artwork.style.display = 'none';
                    document.body.style.backgroundImage = 'none';
                }

                const titleContainer = document.getElementById('title');
                titleText.classList.toggle('scrolling', titleText.scrollWidth > titleContainer.offsetWidth);

                const artworkImg = document.getElementById('artwork');
                const titleEl = document.getElementById('title');

                artworkImg.addEventListener('load', function() {
                    const colorThief = new ColorThief();
                    // Make sure image is loaded and visible
                    if (artworkImg.complete && artworkImg.naturalHeight !== 0) {
                        const dominantColor = colorThief.getColor(artworkImg);
                        titleEl.style.color = `rgb(${dominantColor.join(',')})`;
                    }
                });

            } else {
                titleText.textContent = "No media playing (Youtube or Spotify)";
                playPauseBtn.textContent = "⏯";
                artwork.style.display = 'none';
                document.body.style.backgroundImage = 'none';
                titleText.classList.remove('scrolling');
            }
        });
    }

    function sendCommand(command) {
        runtime.runtime.sendMessage({ action: "sendCommand", command: command });
        setTimeout(updateUI, 100);
    }

    document.getElementById("playpause").onclick = () => sendCommand("playpause");
    document.getElementById("rewind").onclick = () => sendCommand("rewind");
    document.getElementById("forward").onclick = () => sendCommand("forward");

    setInterval(updateUI, 500);
    updateUI();
});