/**
 * Content Script
 *
 * a11y-snapshot-extension - Chrome extension to capture full-page accessibility snapshots
 * Copyright (C) 2026 Ali Almahdi
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * Runs in all frames (including iframes) due to "all_frames": true in manifest
 * Responsibilities:
 * - Collect frame information
 * - Send frame data to background worker
 * - Listen for messages from background
 */
/**
 * Get the current frame ID
 */
function getFrameId() {
    // @ts-ignore - chrome.webNavigation is available in content scripts
    return window.chrome?.webNavigation?.frameId ?? 0;
}
/**
 * Check if this is the top frame (not an iframe)
 */
function isTopFrame() {
    return window.self === window.top;
}
/**
 * Collect frame information
 */
function collectFrameInfo(tabId) {
    const frameId = (() => {
        // Try to get frame ID from various sources
        // @ts-ignore - chrome might have frameId in content script context
        if (typeof chrome !== 'undefined' && chrome.webNavigation) {
            // @ts-ignore
            return chrome.webNavigation.frameId ?? 0;
        }
        return 0;
    })();
    return {
        tabId,
        frameId,
        url: window.location.href,
        title: document.title,
        isTopFrame: isTopFrame(),
        timestamp: Date.now(),
    };
}
/**
 * Send frame information to background worker
 */
async function sendFrameInfo(tabId) {
    try {
        const frameInfo = collectFrameInfo(tabId);
        const message = {
            type: 'FRAME_INFO',
            data: frameInfo,
        };
        await chrome.runtime.sendMessage(message);
        console.log('[A11y Content] Sent frame info:', {
            frameId: frameInfo.frameId,
            url: frameInfo.url,
            isTopFrame: frameInfo.isTopFrame,
        });
    }
    catch (error) {
        console.error('[A11y Content] Failed to send frame info:', error);
    }
}
/**
 * Handle messages from background worker
 */
function handleMessage(message) {
    if (message.type === 'REQUEST_FRAME_DATA') {
        console.log('[A11y Content] Received request for frame data');
        // Get tab ID
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0]?.id;
            if (tabId) {
                sendFrameInfo(tabId);
            }
            else {
                // Fallback: try to get from sender
                console.warn('[A11y Content] Could not determine tab ID');
            }
        });
    }
}
/**
 * Initialize content script
 */
async function init() {
    console.log('[A11y Content] Content script initialized', {
        url: window.location.href,
        isTopFrame: isTopFrame(),
        title: document.title,
    });
    // Wait for tab information
    try {
        const tab = await chrome.tabs.query({ active: true, currentWindow: true });
        const tabId = tab[0]?.id;
        if (tabId) {
            // Send frame info after a short delay to ensure background is ready
            setTimeout(() => {
                sendFrameInfo(tabId);
            }, 100);
        }
        else {
            console.warn('[A11y Content] Could not get tab ID');
        }
    }
    catch (error) {
        console.error('[A11y Content] Error during initialization:', error);
    }
    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message) => {
        handleMessage(message);
        return true; // Keep channel open
    });
}
// Start the content script
init().catch(console.error);
// Export for testing (optional)
export { collectFrameInfo, sendFrameInfo, handleMessage };
//# sourceMappingURL=content.js.map