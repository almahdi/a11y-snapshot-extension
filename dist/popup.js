/**
 * Popup Script
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
 * Handles the extension popup UI:
 * - Display current tab information
 * - Capture button handler
 * - Display results
 * - Download JSON functionality
 */
// DOM Elements
const captureBtn = document.getElementById('captureBtn');
const statusDiv = document.getElementById('status');
const statusText = statusDiv?.querySelector('.status-text');
const tabTitleEl = document.getElementById('tabTitle');
const tabUrlEl = document.getElementById('tabUrl');
const resultsSection = document.getElementById('resultsSection');
const errorSection = document.getElementById('errorSection');
const errorMessageEl = document.getElementById('errorMessage');
const nodeCountEl = document.getElementById('nodeCount');
const frameCountEl = document.getElementById('frameCount');
const captureTimeEl = document.getElementById('captureTime');
const copyBtn = document.getElementById('copyBtn');
const downloadJsonBtn = document.getElementById('downloadJsonBtn');
const viewTreeBtn = document.getElementById('viewTreeBtn');
// State
let currentSnapshot = null;
let captureStartTime = 0;
/**
 * Update the status display
 */
function setStatus(text, type = 'idle') {
    if (!statusDiv || !statusText)
        return;
    statusText.textContent = text;
    statusDiv.className = 'status';
    if (type !== 'idle') {
        statusDiv.classList.add(type);
    }
}
/**
 * Update tab information display
 */
async function updateTabInfo() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            tabTitleEl.textContent = tab.title || 'Unknown';
            tabUrlEl.textContent = tab.url || 'Unknown';
        }
        else {
            tabTitleEl.textContent = 'No active tab';
            tabUrlEl.textContent = '...';
        }
    }
    catch (error) {
        console.error('[Popup] Failed to get tab info:', error);
        tabTitleEl.textContent = 'Error loading tab info';
        tabUrlEl.textContent = '...';
    }
}
/**
 * Show results section
 */
function showResults(snapshot, captureTime) {
    currentSnapshot = snapshot;
    nodeCountEl.textContent = snapshot.axTree.length.toLocaleString();
    frameCountEl.textContent = snapshot.frameCount.toString();
    captureTimeEl.textContent = captureTime.toString();
    resultsSection.style.display = 'block';
    errorSection.style.display = 'none';
}
/**
 * Show error message
 */
function showError(message) {
    errorMessageEl.textContent = message;
    errorSection.style.display = 'block';
    resultsSection.style.display = 'none';
}
/**
 * Hide error section
 */
function hideError() {
    errorSection.style.display = 'none';
}
/**
 * Download snapshot as JSON file
 */
function downloadSnapshot() {
    if (!currentSnapshot) {
        console.error('[Popup] No snapshot to download');
        return;
    }
    const filename = `a11y-snapshot-${currentSnapshot.tabId}-${Date.now()}.json`;
    const dataStr = JSON.stringify(currentSnapshot, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('[Popup] Downloaded snapshot:', filename);
}
/**
 * Copy snapshot JSON to clipboard
 */
async function copyToClipboard() {
    if (!currentSnapshot) {
        console.error('[Popup] No snapshot to copy');
        return;
    }
    const dataStr = JSON.stringify(currentSnapshot, null, 2);
    try {
        await navigator.clipboard.writeText(dataStr);
        // Visual feedback - temporarily change button text
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '✅ Copied!';
        copyBtn.disabled = true;
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
            copyBtn.disabled = false;
        }, 1500);
        console.log('[Popup] Copied snapshot to clipboard');
    }
    catch (error) {
        console.error('[Popup] Failed to copy to clipboard:', error);
        // Fallback for older browsers or when clipboard API fails
        const textarea = document.createElement('textarea');
        textarea.value = dataStr;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '✅ Copied!';
            copyBtn.disabled = true;
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.disabled = false;
            }, 1500);
            console.log('[Popup] Copied snapshot to clipboard (fallback)');
        }
        catch (fallbackError) {
            console.error('[Popup] Fallback copy also failed:', fallbackError);
            copyBtn.innerHTML = '❌ Failed';
            setTimeout(() => {
                copyBtn.innerHTML = '📋 Copy JSON';
            }, 1500);
        }
        document.body.removeChild(textarea);
    }
}
/**
 * View the accessibility tree (opens a new tab with formatted view)
 */
function viewTree() {
    if (!currentSnapshot) {
        console.error('[Popup] No snapshot to view');
        return;
    }
    // Create a simple viewer page
    const viewerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>AXTree Viewer</title>
      <style>
        body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
        h1 { color: #569cd6; }
        .node { margin-left: 20px; }
        .role { color: #4ec9b0; }
        .name { color: #ce9178; }
        .id { color: #9cdcfe; }
        .stats { background: #2d2d30; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .stats h2 { color: #569cd6; margin-bottom: 10px; }
        .stat { margin: 5px 0; }
        pre { background: #2d2d30; padding: 15px; border-radius: 8px; overflow-x: auto; }
      </style>
    </head>
    <body>
      <h1>🔍 Accessibility Tree Viewer</h1>
      <div class="stats">
        <h2>Capture Statistics</h2>
        <div class="stat"><strong>Nodes:</strong> ${currentSnapshot.axTree.length}</div>
        <div class="stat"><strong>Frames:</strong> ${currentSnapshot.frameCount}</div>
        <div class="stat"><strong>Tab ID:</strong> ${currentSnapshot.tabId}</div>
        <div class="stat"><strong>Page Title:</strong> ${currentSnapshot.pageTitle || 'N/A'}</div>
        <div class="stat"><strong>Captured:</strong> ${new Date(currentSnapshot.timestamp).toLocaleString()}</div>
      </div>
      <h2>Raw JSON</h2>
      <pre>${JSON.stringify(currentSnapshot, null, 2)}</pre>
    </body>
    </html>
  `;
    const blob = new Blob([viewerHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    chrome.tabs.create({ url });
    URL.revokeObjectURL(url);
}
/**
 * Request accessibility snapshot from background
 */
async function requestSnapshot(tabId) {
    return new Promise((resolve, reject) => {
        const message = {
            type: 'SNAPSHOT_REQUEST',
            data: { tabId },
        };
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            if (response?.type === 'SNAPSHOT_COMPLETE') {
                const completeMsg = response;
                resolve(completeMsg.data);
            }
            else if (response?.type === 'SNAPSHOT_ERROR') {
                const errorMsg = response;
                reject(new Error(errorMsg.data.error));
            }
            else {
                reject(new Error('Unexpected response'));
            }
        });
    });
}
/**
 * Handle capture button click
 */
async function handleCapture() {
    try {
        // Get current tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
            throw new Error('No active tab found');
        }
        const tabId = tab.id;
        // Update UI for loading state
        setStatus('Capturing accessibility tree...', 'loading');
        captureBtn.disabled = true;
        hideError();
        resultsSection.style.display = 'none';
        captureStartTime = Date.now();
        // Request snapshot from background
        const snapshotData = await requestSnapshot(tabId);
        const captureTime = Date.now() - captureStartTime;
        // Construct full AccessibilitySnapshot
        const snapshot = {
            axTree: snapshotData.axTree,
            frameCount: snapshotData.frameCount,
            frameInfos: snapshotData.frameInfos,
            timestamp: snapshotData.timestamp,
            tabId: snapshotData.tabId,
            pageTitle: tab.title,
            pageUrl: tab.url,
        };
        // Update UI with results
        setStatus('Capture complete!', 'success');
        showResults(snapshot, captureTime);
        console.log('[Popup] Snapshot captured successfully:', {
            nodes: snapshot.axTree.length,
            frames: snapshot.frameCount,
            time: captureTime,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[Popup] Capture failed:', error);
        setStatus('Capture failed', 'error');
        showError(errorMessage);
    }
    finally {
        captureBtn.disabled = false;
    }
}
/**
 * Initialize popup
 */
function init() {
    console.log('[Popup] Initializing...');
    // Update tab info
    updateTabInfo();
    // Set up event listeners
    captureBtn?.addEventListener('click', handleCapture);
    copyBtn?.addEventListener('click', copyToClipboard);
    downloadJsonBtn?.addEventListener('click', downloadSnapshot);
    viewTreeBtn?.addEventListener('click', viewTree);
    // Set initial status
    setStatus('Ready to capture');
    console.log('[Popup] Initialized');
}
// Start the popup
init();
export {};
//# sourceMappingURL=popup.js.map