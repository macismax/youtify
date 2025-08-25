// Firefox/Chrome compatibility
const runtime = (typeof browser !== 'undefined') ? browser : chrome;

let currentMedia = null;

runtime.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateInfo") {
        const newInfo = { ...message.info, tabId: sender.tab.id };

        if (!newInfo.title) {
            if (currentMedia && currentMedia.tabId === sender.tab.id) {
                currentMedia = null;
            }
            return;
        }

        let shouldUpdate = false;
        // --- LOGIC TO PREVENT SWITCHING ---
        // 1. If nothing is stored, update.
        if (!currentMedia) {
            shouldUpdate = true;
        // 2. If new media is playing and old one was paused, update.
        } else if (newInfo.isPlaying && !currentMedia.isPlaying) {
            shouldUpdate = true;
        // 3. If both are playing, update only if it's a newer timestamp.
        } else if (newInfo.isPlaying === currentMedia.isPlaying && newInfo.timestamp >= (currentMedia.timestamp || 0)) {
            shouldUpdate = true;
        // 4. If the update is from the currently tracked tab, always update.
        } else if (currentMedia.tabId === newInfo.tabId) {
            shouldUpdate = true;
        }

        if (shouldUpdate) {
            // If the new info is for a new song, replace everything.
            if (!currentMedia || currentMedia.title !== newInfo.title) {
                currentMedia = newInfo;
            } else {
                // It's the same song, so merge carefully to preserve image.
                currentMedia = {
                    ...newInfo,
                    image: newInfo.image || currentMedia.image
                };
            }
        }
        sendResponse({ status: "ok" });
    }
    else if (message.action === "getInfo") {
        sendResponse(currentMedia);
    }
    else if (message.action === "sendCommand") {
        if (currentMedia && currentMedia.tabId) {
            runtime.tabs.sendMessage(currentMedia.tabId, { command: message.command });
        }
    }
    return true; // Keep the message channel open for async response
});