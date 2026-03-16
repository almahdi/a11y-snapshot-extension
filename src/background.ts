/**
 * Background Service Worker
 * 
 * Handles:
 * - Debugger attachment/detachment
 * - CDP Accessibility API calls
 * - Message passing between content scripts and popup
 * - Aggregating frame information
 */

import type {
  AXNode,
  FrameInfo,
  ExtensionMessage,
  SnapshotRequestMessage,
  SnapshotCompleteMessage,
  SnapshotErrorMessage,
  FrameInfoMessage,
  AccessibilitySnapshot,
} from './types';

// Store frame information per tab
const tabFrameInfo = new Map<number, FrameInfo[]>();

// Store debugger state per tab
const debuggerState = new Map<number, boolean>();

/**
 * Enable the Accessibility domain via CDP
 */
async function enableAccessibility(tabId: number): Promise<void> {
  await chrome.debugger.sendCommand({ tabId }, 'Accessibility.enable');
}

/**
 * Get the full accessibility tree for a tab
 */
async function getFullAXTree(tabId: number): Promise<AXNode[]> {
  const response = await chrome.debugger.sendCommand(
    { tabId },
    'Accessibility.getFullAXTree',
    { depth: -1 }
  );
  
  return (response as { nodes: AXNode[] }).nodes;
}

/**
 * Attach debugger to a tab
 */
async function attachDebugger(tabId: number): Promise<void> {
  const isAttached = debuggerState.get(tabId) || false;
  
  if (isAttached) {
    console.log(`[A11y] Debugger already attached to tab ${tabId}`);
    return;
  }
  
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    debuggerState.set(tabId, true);
    console.log(`[A11y] Debugger attached to tab ${tabId}`);
    
    // Enable accessibility domain
    await enableAccessibility(tabId);
    console.log(`[A11y] Accessibility domain enabled for tab ${tabId}`);
  } catch (error) {
    console.error(`[A11y] Failed to attach debugger to tab ${tabId}:`, error);
    throw new Error(`Failed to attach debugger: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Detach debugger from a tab
 */
async function detachDebugger(tabId: number): Promise<void> {
  const isAttached = debuggerState.get(tabId) || false;
  
  if (!isAttached) {
    console.log(`[A11y] Debugger not attached to tab ${tabId}`);
    return;
  }
  
  try {
    await chrome.debugger.detach({ tabId });
    debuggerState.set(tabId, false);
    console.log(`[A11y] Debugger detached from tab ${tabId}`);
  } catch (error) {
    console.error(`[A11y] Failed to detach debugger from tab ${tabId}:`, error);
  }
}

/**
 * Get all frame IDs for a tab
 */
async function getAllFrameIds(tabId: number): Promise<number[]> {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    return frames?.map(frame => frame.frameId) ?? [0];
  } catch (error) {
    console.error(`[A11y] Failed to get frame IDs for tab ${tabId}:`, error);
    // Fallback: assume only main frame (frameId: 0)
    return [0];
  }
}

/**
 * Request frame information from all content scripts in a tab
 */
async function requestFrameInfo(tabId: number): Promise<FrameInfo[]> {
  return new Promise((resolve) => {
    const frameInfos: FrameInfo[] = [];
    let responsesReceived = 0;
    const timeout = 3000; // 3 second timeout
    
    // Clear any existing frame info for this tab
    tabFrameInfo.delete(tabId);
    
    // Send message to all frames
    chrome.tabs.sendMessage(tabId, { type: 'REQUEST_FRAME_DATA' as const }, (response) => {
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
 * Capture accessibility snapshot for a tab
 */
export async function captureAccessibilitySnapshot(tabId: number): Promise<AccessibilitySnapshot> {
  const startTime = Date.now();
  
  try {
    console.log(`[A11y] Starting accessibility snapshot for tab ${tabId}`);
    
    // Attach debugger
    await attachDebugger(tabId);
    
    // Get the full AXTree
    console.log(`[A11y] Fetching AXTree for tab ${tabId}`);
    const axTree = await getFullAXTree(tabId);
    console.log(`[A11y] Retrieved ${axTree.length} nodes from AXTree`);
    
    // Get frame information
    let frameInfos = tabFrameInfo.get(tabId) || [];
    if (frameInfos.length === 0) {
      // Try to get frame info from webNavigation API
      try {
        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        frameInfos = (frames ?? []).map(frame => ({
          tabId,
          frameId: frame.frameId,
          url: frame.url,
          title: '', // We don't have title from this API
          isTopFrame: frame.frameId === 0,
          timestamp: Date.now(),
        }));
      } catch (error) {
        console.error(`[A11y] Failed to get frame info:`, error);
        // Create minimal frame info
        frameInfos = [{
          tabId,
          frameId: 0,
          url: '',
          title: '',
          isTopFrame: true,
          timestamp: Date.now(),
        }];
      }
    }
    
    // Get tab information
    const tab = await chrome.tabs.get(tabId);
    
    const snapshot: AccessibilitySnapshot = {
      axTree,
      frameCount: frameInfos.length,
      frameInfos,
      timestamp: Date.now(),
      tabId,
      pageTitle: tab.title,
      pageUrl: tab.url,
    };
    
    console.log(`[A11y] Snapshot complete in ${Date.now() - startTime}ms for tab ${tabId}`);
    console.log(`[A11y] - ${axTree.length} AX nodes`);
    console.log(`[A11y] - ${frameInfos.length} frames`);
    
    return snapshot;
  } catch (error) {
    console.error(`[A11y] Error capturing snapshot:`, error);
    throw error;
  } finally {
    // Always detach the debugger
    await detachDebugger(tabId);
  }
}

/**
 * Handle messages from popup
 */
async function handlePopupMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
): Promise<void> {
  if (message.type === 'SNAPSHOT_REQUEST') {
    const request = message as SnapshotRequestMessage;
    const tabId = request.data?.tabId || sender.tab?.id;
    
    if (!tabId) {
      sendResponse({
        type: 'SNAPSHOT_ERROR',
        data: {
          success: false,
          error: 'No tab ID provided',
          tabId: 0,
        },
      } as SnapshotErrorMessage);
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
      } as SnapshotCompleteMessage);
    } catch (error) {
      sendResponse({
        type: 'SNAPSHOT_ERROR',
        data: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          tabId,
        },
      } as SnapshotErrorMessage);
    }
  }
}

/**
 * Handle messages from content scripts
 */
function handleContentScriptMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): void {
  if (message.type === 'FRAME_INFO') {
    const frameInfoMsg = message as FrameInfoMessage;
    const tabId = frameInfoMsg.data.tabId;
    
    if (!tabFrameInfo.has(tabId)) {
      tabFrameInfo.set(tabId, []);
    }
    
    const frames = tabFrameInfo.get(tabId)!;
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
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender: chrome.runtime.MessageSender, sendResponse) => {
    if (sender.tab) {
      // Message from content script
      handleContentScriptMessage(message, sender);
    } else {
      // Message from popup
      handlePopupMessage(message, sender, sendResponse);
    }
    
    // Keep message channel open for async response
    return true;
  }
);

/**
 * Handle debugger detachment events
 */
chrome.debugger.onDetach.addListener((source, reason) => {
  console.log(`[A11y] Debugger detached from tab ${source.tabId}: ${reason}`);
  debuggerState.set(source.tabId!, false);
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
