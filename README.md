# A11y Snapshot Extension

A Chrome extension (Manifest V3) written in TypeScript that captures full-page accessibility snapshots including content inside iframes using the Chrome DevTools Protocol (CDP) Accessibility API.

## Features

- 🔍 **Full Accessibility Tree Capture**: Get the complete AXTree for any webpage
- 🖼️ **Iframe Support**: Captures accessibility data from all frames including cross-origin iframes
- 📊 **Detailed Statistics**: View node count, frame count, and capture time
- 💾 **JSON Export**: Download snapshots as JSON files for analysis
- 👁️ **Tree Viewer**: Built-in viewer to inspect captured accessibility trees
- ⚡ **Fast & Efficient**: Uses native CDP APIs for optimal performance

## Installation

### Development

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist/` folder

### Usage

1. Navigate to any webpage you want to analyze
2. Click the extension icon in the toolbar
3. Click "Capture Snapshot"
4. View the results:
   - **AX Nodes**: Total number of accessibility nodes captured
   - **Frames**: Number of frames (including iframes) processed
   - **Time**: Capture duration in milliseconds
5. Download the JSON or view the tree

## Project Structure

```
a11y-snapshot-extension/
├── src/
│   ├── manifest.json       # Extension manifest (V3)
│   ├── types.ts            # TypeScript types
│   ├── background.ts       # Service worker
│   ├── content.ts          # Content script
│   ├── popup.html          # Popup UI
│   ├── popup.css           # Popup styles
│   ├── popup.ts            # Popup logic
│   └── icons/              # Extension icons
├── dist/                   # Build output
├── package.json
├── tsconfig.json
└── plan.md
```

## How It Works

### Architecture

```
┌─────────────────────────────────────┐
│      Background Service Worker      │
│  - chrome.debugger attachment       │
│  - CDP Accessibility.getFullAXTree  │
│  - Message routing                  │
└─────────────────────────────────────┘
                │
                │ chrome.debugger API
                ▼
┌─────────────────────────────────────┐
│           Chrome Tab                │
│  ┌──────────┐    ┌──────────────┐  │
│  │ Top Frame│    │   iframe     │  │
│  │ content  │    │   content    │  │
│  │ script   │    │   script     │  │
│  └──────────┘    └──────────────┘  │
└─────────────────────────────────────┘
```

### Key Technologies

1. **Chrome DevTools Protocol (CDP)**: Low-level protocol for browser automation
2. **Accessibility Domain**: CDP domain for accessibility tree access
3. **chrome.debugger API**: Extension API for CDP access
4. **Message Passing**: Communication between extension components

## Commands

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Watch mode (auto-rebuild on changes)
npm run watch

# Type check only
npm run typecheck

# Clean build artifacts
npm run clean
```

## Important Notes

### Debugger Warning Bar

When the extension captures a snapshot, Chrome displays a warning bar at the top of the browser:

> "An extension is debugging this browser"

This is a **security requirement** and cannot be hidden. The debugger must be attached to use the CDP Accessibility API.

### Permissions

The extension requires:
- `debugger`: To attach to tabs and call CDP commands
- `tabs`: To get tab information
- `activeTab`: To access the current tab
- `<all_urls>`: To inject content scripts into all frames

### Cross-Origin Iframes

The extension uses `all_frames: true` in the manifest to inject content scripts into all iframes. However, you must have host permissions for the iframe domains to capture their content.

### Performance

- Large/complex pages may take longer to capture
- The AXTree JSON can be very large (megabytes) for complex pages
- The debugger is automatically detached after capture to minimize performance impact

## Troubleshooting

### "No active tab found"
- Make sure you have a webpage open (not chrome:// pages)
- Try refreshing the page

### "Failed to attach debugger"
- Another extension might be debugging the tab
- Close other debugging tools and try again

### Missing iframe content
- Ensure you have permissions for the iframe domain
- Some sites block iframe embedding (X-Frame-Options)

### Large capture times
- Complex pages with many nodes take longer
- This is normal for pages with thousands of elements

## Development

### Adding New Features

1. Make changes in `src/` directory
2. Run `npm run build` or use watch mode
3. Reload the extension in `chrome://extensions/`
4. Test the changes

### Debugging

- **Background script**: Open DevTools on the service worker via `chrome://extensions/`
- **Content script**: Open DevTools on the webpage
- **Popup**: Right-click popup → "Inspect"

### Type Safety

The project uses strict TypeScript configuration. Run `npm run typecheck` to verify types without building.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## Resources

- [Chrome DevTools Protocol - Accessibility Domain](https://chromedevtools.github.io/devtools-protocol/tot/Accessibility/)
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Overview](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Accessibility Tree Documentation](https://developer.mozilla.org/en-US/docs/Glossary/Accessibility_tree)
