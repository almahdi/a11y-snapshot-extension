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