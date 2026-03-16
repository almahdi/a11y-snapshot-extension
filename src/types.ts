/**
 * CDP Accessibility API Types
 * Based on Chrome DevTools Protocol Accessibility domain
 * @see https://chromedevtools.github.io/devtools-protocol/tot/Accessibility/
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
 */

/**
 * A node in the accessibility tree
 */
export interface AXNode {
  /** Unique identifier for this node */
  nodeId: string;
  
  /** The backend DOM node ID (can be used to query the DOM) */
  backendDOMNodeId?: number;
  
  /** The frame this node belongs to */
  frameId?: string;
  
  /** Whether this node is ignored for accessibility */
  ignored?: boolean;
  
  /** Reason for being ignored (if applicable) */
  ignoredReasons?: AXProperty[];
  
  /** Array of child node IDs */
  childIds?: string[];
  
  /** Node properties (role, name, value, etc.) */
  role?: AXValue;
  name?: AXValue;
  description?: AXValue;
  value?: AXValue;
  
  /** Additional properties */
  properties?: AXProperty[];
  
  /** Chrome AXTree properties */
  chromeRole?: AXValue;
  ariaRole?: AXValue;
  roleDescription?: AXValue;
  state?: AXProperty[];
  className?: AXValue;
  id?: AXValue;
  liveRegion?: AXValue;
  liveRegionStatus?: AXValue;
  liveRegionRootId?: AXValue;
  containerLiveRegionRootId?: AXValue;
  liveRegionLabel?: AXValue;
  liveRegionAtomic?: AXValue;
  liveRegionRelevant?: AXValue;
  containerLiveRegion?: AXValue;
  tooltip?: AXValue;
  parentAXNodeId?: AXNodeId;
  uniqueAXNodeId?: AXValue;
  position?: AXValue;
  size?: AXValue;
  DOMNode?: AXValue;
  accessibilityNode?: AXValue;
  accessibilityNodeIndex?: number;
  indexInParent?: number;
  filtered?: boolean;
  found?: boolean;
}

/**
 * Reference to an AXNode
 */
export interface AXNodeId {
  nodeId?: string;
  backendDOMNodeId?: number;
  iframeAXNodeId?: AXNodeId;
}

/**
 * Value for an accessibility property
 */
export interface AXValue {
  /** The type of this value */
  type: 'string' | 'boolean' | 'idref' | 'idrefList' | 'integer' | 'nodeId' | 'nodeIdList' | 'number' | 'token' | 'tokenList' | 'unknown' | 'attributeValue' | 'documentIndexInAncestorSet' | 'internalSourceType' | 'axNodeId' | 'cellCoord' | 'domRelation' | 'background-color' | 'foreground-color' | 'rect' | 'size' | 'numberPair';
  
  /** The value itself (type depends on the type field) */
  value?: any;
  
  /** Related node IDs (for idref types) */
  relatedNodeIds?: AXNodeId[];
  
  /** Sources for this value */
  sources?: AXValueSource[];
  
  /** Invalid status */
  invalid?: AXValueInvalidStatus;
  
  /** Invalid reason */
  invalidReason?: string;
}

/**
 * Source of an accessibility property value
 */
export interface AXValueSource {
  /** The type of source */
  type: 'attribute' | 'author' | 'contents' | 'css' | 'placeholder' | 'relatedElement' | 'valueFromElement' | 'valueFromControl' | 'implicit';
  
  /** The value from this source */
  value?: AXValue;
  
  /** Superseded by another source */
  superseded?: boolean;
  
  /** Native HTML attribute */
  attribute?: string;
  
  /** CSS property */
  cssProperty?: string;
  
  /** Source node */
  sourceNode?: AXNodeId;
  
  /** Source attribute */
  sourceAttribute?: string;
}

/**
 * Invalid status for AXValue
 */
export interface AXValueInvalidStatus {
  /** Is invalid */
  invalid?: boolean;
  
  /** Error code */
  errorCode?: string;
  
  /** Error message */
  errorMessage?: string;
}

/**
 * Property in the accessibility tree
 */
export interface AXProperty {
  /** Property name */
  name: string;
  
  /** Property value */
  value: AXValue;
}

/**
 * Response from Accessibility.getFullAXTree
 */
export interface GetFullAXTreeResponse {
  /** Array of accessibility nodes */
  nodes: AXNode[];
}

/**
 * Response from Accessibility.getSnapshot
 */
export interface GetSnapshotResponse {
  /** Array of accessibility nodes */
  nodes: AXNode[];
}

/**
 * Parameters for Accessibility.queryAXTree
 */
export interface QueryAXTreeParams {
  /** Accessible name to search for */
  accessibleName?: string;
  
  /** ARIA role to search for */
  role?: string;
}

/**
 * Response from Accessibility.queryAXTree
 */
export interface QueryAXTreeResponse {
  /** Array of matching nodes */
  nodes: AXNode[];
}

// ============================================================================
// Message Passing Types
// ============================================================================

/**
 * Message types for communication between extension components
 */
export type MessageType =
  | 'FRAME_INFO'
  | 'REQUEST_FRAME_DATA'
  | 'SNAPSHOT_REQUEST'
  | 'SNAPSHOT_COMPLETE'
  | 'SNAPSHOT_ERROR'
  | 'DEBUGGER_ATTACHED'
  | 'DEBUGGER_DETACHED';

/**
 * Base message interface
 */
export interface BaseMessage {
  type: MessageType;
}

/**
 * Frame information sent from content script to background
 */
export interface FrameInfoMessage extends BaseMessage {
  type: 'FRAME_INFO';
  data: {
    tabId: number;
    frameId: number;
    url: string;
    title: string;
    isTopFrame: boolean;
    timestamp: number;
  };
}

/**
 * Request for frame data from background to content script
 */
export interface RequestFrameDataMessage extends BaseMessage {
  type: 'REQUEST_FRAME_DATA';
}

/**
 * Snapshot request from popup to background
 */
export interface SnapshotRequestMessage extends BaseMessage {
  type: 'SNAPSHOT_REQUEST';
  data: {
    tabId: number;
    includeFrames?: boolean;
  };
}

/**
 * Snapshot complete message from background to popup
 */
export interface SnapshotCompleteMessage extends BaseMessage {
  type: 'SNAPSHOT_COMPLETE';
  data: {
    success: true;
    axTree: AXNode[];
    frameCount: number;
    frameInfos: FrameInfo[];
    timestamp: number;
    tabId: number;
  };
}

/**
 * Snapshot error message from background to popup
 */
export interface SnapshotErrorMessage extends BaseMessage {
  type: 'SNAPSHOT_ERROR';
  data: {
    success: false;
    error: string;
    tabId: number;
  };
}

/**
 * Debugger attached notification
 */
export interface DebuggerAttachedMessage extends BaseMessage {
  type: 'DEBUGGER_ATTACHED';
  data: {
    tabId: number;
  };
}

/**
 * Debugger detached notification
 */
export interface DebuggerDetachedMessage extends BaseMessage {
  type: 'DEBUGGER_DETACHED';
  data: {
    tabId: number;
  };
}

/**
 * Union type for all messages
 */
export type ExtensionMessage =
  | FrameInfoMessage
  | RequestFrameDataMessage
  | SnapshotRequestMessage
  | SnapshotCompleteMessage
  | SnapshotErrorMessage
  | DebuggerAttachedMessage
  | DebuggerDetachedMessage;

/**
 * Frame information collected from content scripts
 */
export interface FrameInfo {
  tabId: number;
  frameId: number | string;  // Can be numeric (webNavigation) or string (CDP frameId)
  url: string;
  title: string;
  isTopFrame: boolean;
  timestamp: number;
}

/**
 * Complete accessibility snapshot result
 */
export interface AccessibilitySnapshot {
  axTree: AXNode[];
  frameCount: number;
  frameInfos: FrameInfo[];
  timestamp: number;
  tabId: number;
  pageTitle?: string;
  pageUrl?: string;
}

/**
 * CDP Debug target
 */
export interface DebugTarget {
  tabId: number;
}

// ============================================================================
// Helper Type Guards
// ============================================================================

/**
 * Type guard to check if a message is FrameInfoMessage
 */
export function isFrameInfoMessage(msg: ExtensionMessage): msg is FrameInfoMessage {
  return msg.type === 'FRAME_INFO';
}

/**
 * Type guard to check if a message is SnapshotRequestMessage
 */
export function isSnapshotRequestMessage(msg: ExtensionMessage): msg is SnapshotRequestMessage {
  return msg.type === 'SNAPSHOT_REQUEST';
}

/**
 * Type guard to check if a message has snapshot complete data
 */
export function isSnapshotCompleteMessage(msg: ExtensionMessage): msg is SnapshotCompleteMessage {
  return msg.type === 'SNAPSHOT_COMPLETE';
}

/**
 * Type guard to check if a message has snapshot error data
 */
export function isSnapshotErrorMessage(msg: ExtensionMessage): msg is SnapshotErrorMessage {
  return msg.type === 'SNAPSHOT_ERROR';
}
