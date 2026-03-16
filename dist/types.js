/**
 * CDP Accessibility API Types
 * Based on Chrome DevTools Protocol Accessibility domain
 * @see https://chromedevtools.github.io/devtools-protocol/tot/Accessibility/
 */
// ============================================================================
// Helper Type Guards
// ============================================================================
/**
 * Type guard to check if a message is FrameInfoMessage
 */
export function isFrameInfoMessage(msg) {
    return msg.type === 'FRAME_INFO';
}
/**
 * Type guard to check if a message is SnapshotRequestMessage
 */
export function isSnapshotRequestMessage(msg) {
    return msg.type === 'SNAPSHOT_REQUEST';
}
/**
 * Type guard to check if a message has snapshot complete data
 */
export function isSnapshotCompleteMessage(msg) {
    return msg.type === 'SNAPSHOT_COMPLETE';
}
/**
 * Type guard to check if a message has snapshot error data
 */
export function isSnapshotErrorMessage(msg) {
    return msg.type === 'SNAPSHOT_ERROR';
}
//# sourceMappingURL=types.js.map