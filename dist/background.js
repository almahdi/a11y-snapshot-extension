/**
 * Background Service Worker
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
 * Handles:
 * - Debugger attachment/detachment
 * - CDP Accessibility API calls
 * - Message passing between content scripts and popup
 * - Aggregating frame information
 */
// Store frame information per tab
const tabFrameInfo = new Map();
// Store debugger state per tab
const debuggerState = new Map();
/**
 * Enable the Accessibility domain via CDP
 */
async function enableAccessibility(tabId) {
    await chrome.debugger.sendCommand({ tabId }, 'Accessibility.enable');
}
/**
 * Recursively collect all frame IDs from a frame tree
 */
function collectAllFrameIds(frameTree) {
    const ids = [];
    if (frameTree.frame?.id) {
        ids.push(frameTree.frame.id);
    }
    if (frameTree.childFrames && Array.isArray(frameTree.childFrames)) {
        for (const child of frameTree.childFrames) {
            ids.push(...collectAllFrameIds(child));
        }
    }
    return ids;
}
/**
 * Get all frame IDs for a tab using CDP Page.getFrameTree
 */
async function getCDPFrameIds(tabId) {
    try {
        const response = await chrome.debugger.sendCommand({ tabId }, 'Page.getFrameTree');
        const frameTree = response;
        const frameIds = collectAllFrameIds(frameTree.frameTree);
        console.log(`[A11y] Found ${frameIds.length} CDP frames:`, frameIds);
        return frameIds;
    }
    catch (error) {
        console.error(`[A11y] Failed to get frame tree for tab ${tabId}:`, error);
        // Fallback: try to get from webNavigation API
        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        return frames?.map(f => String(f.frameId)) ?? ['0'];
    }
}
/**
 * Get the full accessibility tree for a specific frame
 */
async function getAXTreeForFrame(tabId, frameId) {
    const response = await chrome.debugger.sendCommand({ tabId }, 'Accessibility.getFullAXTree', { frameId, depth: -1 });
    return response.nodes;
}
/**
 * Get the full accessibility tree for a tab, including all iframes
 */
async function getFullAXTree(tabId) {
    try {
        // Get all frame IDs in the page
        const frameIds = await getCDPFrameIds(tabId);
        console.log(`[A11y] Fetching AX trees for ${frameIds.length} frames in tab ${tabId}`);
        // Fetch AX tree for each frame
        const allTrees = [];
        for (const frameId of frameIds) {
            try {
                const nodes = await getAXTreeForFrame(tabId, frameId);
                console.log(`[A11y] - Frame ${frameId}: ${nodes.length} nodes`);
                allTrees.push(nodes);
            }
            catch (error) {
                console.warn(`[A11y] Failed to get AX tree for frame ${frameId}:`, error);
                // Continue with other frames even if one fails
            }
        }
        // Combine all trees into one array
        const combinedTree = allTrees.flat();
        console.log(`[A11y] Combined tree has ${combinedTree.length} total nodes`);
        return combinedTree;
    }
    catch (error) {
        console.error(`[A11y] Error getting full AX tree:`, error);
        // Fallback: try to get just the main frame tree
        console.log(`[A11y] Falling back to main frame only`);
        const response = await chrome.debugger.sendCommand({ tabId }, 'Accessibility.getFullAXTree', { depth: -1 });
        return response.nodes;
    }
}
/**
 * Check if a URL can be debugged
 */
function isUrlDebuggable(url) {
    if (!url)
        return false;
    const restrictedPrefixes = [
        'chrome://',
        'chrome-extension://',
        'about:',
        'edge://',
        'brave://',
        'vivaldi://',
        'opera://',
        'devtools://',
    ];
    return !restrictedPrefixes.some(prefix => url.startsWith(prefix));
}
/**
 * Attach debugger to a tab
 */
async function attachDebugger(tabId) {
    const isAttached = debuggerState.get(tabId) || false;
    if (isAttached) {
        console.log(`[A11y] Debugger already attached to tab ${tabId}`);
        return;
    }
    // Check if the tab's URL is debuggable
    const tab = await chrome.tabs.get(tabId);
    if (!isUrlDebuggable(tab.url)) {
        throw new Error(`Cannot capture snapshot on this page. Chrome internal pages (chrome://, about:, etc.) are not accessible. Please navigate to a regular webpage.`);
    }
    try {
        await chrome.debugger.attach({ tabId }, '1.3');
        debuggerState.set(tabId, true);
        console.log(`[A11y] Debugger attached to tab ${tabId}`);
        // Enable accessibility domain
        await enableAccessibility(tabId);
        console.log(`[A11y] Accessibility domain enabled for tab ${tabId}`);
    }
    catch (error) {
        console.error(`[A11y] Failed to attach debugger to tab ${tabId}:`, error);
        throw new Error(`Failed to attach debugger: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Detach debugger from a tab
 */
async function detachDebugger(tabId) {
    const isAttached = debuggerState.get(tabId) || false;
    if (!isAttached) {
        console.log(`[A11y] Debugger not attached to tab ${tabId}`);
        return;
    }
    try {
        await chrome.debugger.detach({ tabId });
        debuggerState.set(tabId, false);
        console.log(`[A11y] Debugger detached from tab ${tabId}`);
    }
    catch (error) {
        console.error(`[A11y] Failed to detach debugger from tab ${tabId}:`, error);
    }
}
/**
 * Get all frame IDs for a tab
 */
async function getAllFrameIds(tabId) {
    try {
        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        return frames?.map(frame => frame.frameId) ?? [0];
    }
    catch (error) {
        console.error(`[A11y] Failed to get frame IDs for tab ${tabId}:`, error);
        // Fallback: assume only main frame (frameId: 0)
        return [0];
    }
}
/**
 * Request frame information from all content scripts in a tab
 */
async function requestFrameInfo(tabId) {
    return new Promise((resolve) => {
        const frameInfos = [];
        let responsesReceived = 0;
        const timeout = 3000; // 3 second timeout
        // Clear any existing frame info for this tab
        tabFrameInfo.delete(tabId);
        // Send message to all frames
        chrome.tabs.sendMessage(tabId, { type: 'REQUEST_FRAME_DATA' }, (response) => {
            // Note: This only gets the first response, so we use onMessage for all frames
        });
        // Set timeout to resolve with whatever we have
        const timeoutId = setTimeout(() => {
            console.log(`[A11y] Frame info collection timeout for tab ${tabId}, got ${frameInfos.length} frames`);
            tabFrameInfo.set(tabId, frameInfos);
            resolve(frameInfos);
        }, timeout);
        // We'll collect responses via onMessage listener below
        // For now, resolve after timeout
        setTimeout(() => {
            const stored = tabFrameInfo.get(tabId);
            if (stored && stored.length > 0) {
                clearTimeout(timeoutId);
                resolve(stored);
            }
        }, timeout);
    });
}
/**
 * Collect frame info from CDP frame tree
 */
function collectFrameInfoFromTree(frameTree, tabId, timestamp) {
    const infos = [];
    function processFrame(frame, isTopFrame) {
        if (frame.frame?.id) {
            // Use the full CDP frame ID (string) to match AXTree nodes
            infos.push({
                tabId,
                frameId: frame.frame.id,
                url: frame.frame.url || '',
                title: '',
                isTopFrame,
                timestamp,
            });
        }
        if (frame.childFrames && Array.isArray(frame.childFrames)) {
            for (const child of frame.childFrames) {
                processFrame(child, false);
            }
        }
    }
    processFrame(frameTree, true);
    return infos;
}
/**
 * Capture accessibility snapshot for a tab
 */
export async function captureAccessibilitySnapshot(tabId) {
    const startTime = Date.now();
    try {
        console.log(`[A11y] Starting accessibility snapshot for tab ${tabId}`);
        // Attach debugger
        await attachDebugger(tabId);
        // Get the full AXTree (including all frames)
        console.log(`[A11y] Fetching AXTree for tab ${tabId}`);
        const axTree = await getFullAXTree(tabId);
        console.log(`[A11y] Retrieved ${axTree.length} nodes from AXTree`);
        // Get frame information from CDP first (preferred, matches AXTree frameIds)
        let frameInfos = [];
        const timestamp = Date.now();
        try {
            const frameTreeResponse = await chrome.debugger.sendCommand({ tabId }, 'Page.getFrameTree');
            const frameTree = frameTreeResponse.frameTree;
            frameInfos = collectFrameInfoFromTree(frameTree, tabId, timestamp);
            console.log(`[A11y] Got ${frameInfos.length} frames from CDP frame tree`);
        }
        catch (error) {
            console.warn(`[A11y] Failed to get frame tree from CDP, falling back to webNavigation:`, error);
        }
        // If CDP didn't give us frame info, try content scripts
        if (frameInfos.length === 0) {
            frameInfos = tabFrameInfo.get(tabId) || [];
            if (frameInfos.length > 0) {
                console.log(`[A11y] Got ${frameInfos.length} frames from content scripts`);
            }
        }
        // Last fallback: webNavigation API
        if (frameInfos.length === 0) {
            try {
                const frames = await chrome.webNavigation.getAllFrames({ tabId });
                frameInfos = (frames ?? []).map(frame => ({
                    tabId,
                    frameId: frame.frameId,
                    url: frame.url,
                    title: '',
                    isTopFrame: frame.frameId === 0,
                    timestamp,
                }));
                console.log(`[A11y] Got ${frameInfos.length} frames from webNavigation`);
            }
            catch (error) {
                console.error(`[A11y] Failed to get frame info from webNavigation:`, error);
            }
        }
        // Ultimate fallback: create minimal frame info
        if (frameInfos.length === 0) {
            frameInfos = [{
                    tabId,
                    frameId: 0,
                    url: '',
                    title: '',
                    isTopFrame: true,
                    timestamp,
                }];
            console.log(`[A11y] Using minimal frame info (1 frame)`);
        }
        // Get tab information
        const tab = await chrome.tabs.get(tabId);
        const snapshot = {
            axTree,
            frameCount: frameInfos.length,
            frameInfos,
            timestamp,
            tabId,
            pageTitle: tab.title,
            pageUrl: tab.url,
        };
        console.log(`[A11y] Snapshot complete in ${Date.now() - startTime}ms for tab ${tabId}`);
        console.log(`[A11y] - ${axTree.length} AX nodes`);
        console.log(`[A11y] - ${frameInfos.length} frames`);
        return snapshot;
    }
    catch (error) {
        console.error(`[A11y] Error capturing snapshot:`, error);
        throw error;
    }
    finally {
        // Always detach the debugger
        await detachDebugger(tabId);
    }
}
/**
 * Handle messages from popup
 */
async function handlePopupMessage(message, sender, sendResponse) {
    if (message.type === 'SNAPSHOT_REQUEST') {
        const request = message;
        const tabId = request.data?.tabId || sender.tab?.id;
        if (!tabId) {
            sendResponse({
                type: 'SNAPSHOT_ERROR',
                data: {
                    success: false,
                    error: 'No tab ID provided',
                    tabId: 0,
                },
            });
            return;
        }
        try {
            const snapshot = await captureAccessibilitySnapshot(tabId);
            sendResponse({
                type: 'SNAPSHOT_COMPLETE',
                data: {
                    success: true,
                    axTree: snapshot.axTree,
                    frameCount: snapshot.frameCount,
                    frameInfos: snapshot.frameInfos,
                    timestamp: snapshot.timestamp,
                    tabId: snapshot.tabId,
                },
            });
        }
        catch (error) {
            sendResponse({
                type: 'SNAPSHOT_ERROR',
                data: {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    tabId,
                },
            });
        }
    }
}
/**
 * Handle messages from content scripts
 */
function handleContentScriptMessage(message, sender) {
    if (message.type === 'FRAME_INFO') {
        const frameInfoMsg = message;
        const tabId = frameInfoMsg.data.tabId;
        if (!tabFrameInfo.has(tabId)) {
            tabFrameInfo.set(tabId, []);
        }
        const frames = tabFrameInfo.get(tabId);
        // Avoid duplicates
        const exists = frames.some(f => f.frameId === frameInfoMsg.data.frameId);
        if (!exists) {
            frames.push(frameInfoMsg.data);
            console.log(`[A11y] Received frame info from frame ${frameInfoMsg.data.frameId} in tab ${tabId}`);
        }
    }
}
// ============================================================================
// Event Listeners
// ============================================================================
/**
 * Listen for messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.tab) {
        // Message from content script
        handleContentScriptMessage(message, sender);
    }
    else {
        // Message from popup
        handlePopupMessage(message, sender, sendResponse);
    }
    // Keep message channel open for async response
    return true;
});
/**
 * Handle debugger detachment events
 */
chrome.debugger.onDetach.addListener((source, reason) => {
    console.log(`[A11y] Debugger detached from tab ${source.tabId}: ${reason}`);
    debuggerState.set(source.tabId, false);
});
/**
 * Handle tab removal - cleanup
 */
chrome.tabs.onRemoved.addListener((tabId) => {
    tabFrameInfo.delete(tabId);
    debuggerState.delete(tabId);
    console.log(`[A11y] Cleaned up data for removed tab ${tabId}`);
});
/**
 * Extension installation handler
 */
chrome.runtime.onInstalled.addListener((details) => {
    console.log('[A11y] Extension installed:', details.reason);
});
console.log('[A11y] Background service worker initialized');
//# sourceMappingURL=background.js.map