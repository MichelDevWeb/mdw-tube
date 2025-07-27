# 🎵 MDW Tube - YouTube Playlist Manager

A powerful Chrome Extension for managing YouTube playlists with smart recommendations from your subscribed channels.

## ✨ Features

### 🎯 Core Features
- **Smart Video Recommendations**: Get video suggestions from your subscribed channels
- **Channel Toggle Control**: Enable/disable channels for recommendations
- **Playlist Management**: Create, edit, and organize playlists
- **Drag & Drop Reordering**: Easily reorder videos in playlists
- **Picture-in-Picture**: Auto PiP mode for seamless video watching
- **Modern UI**: Clean, intuitive interface with smooth animations

### 🔧 Advanced Features
- **Auto-PiP**: Automatically enable Picture-in-Picture when playing videos
- **Playlist Export**: Export playlists as JSON files
- **Visual Shuffle**: Shuffle playlist order (visual preview)
- **Watch History Integration**: Track and filter unwatched videos
- **Responsive Design**: Works perfectly on all screen sizes

## 🚀 Installation

### Prerequisites
- Chrome Browser (Version 88+)
- Google Account with YouTube access
- Google Cloud Console project with YouTube Data API v3 enabled

### Step 1: Google Cloud Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **YouTube Data API v3**
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client IDs**
5. Set **Application type** to **Chrome extension**
6. Note down your **Client ID**

### Step 2: Extension Setup
1. Download/clone the MDW Tube extension files
2. Open `manifest.json` and replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID
3. Open Chrome and go to `chrome://extensions/`
4. Enable **Developer mode**
5. Click **Load unpacked** and select the extension folder
6. Note the **Extension ID** from the extensions page

### Step 3: Configure OAuth
1. Go back to Google Cloud Console → Credentials
2. Edit your OAuth 2.0 Client ID
3. Set **Extension ID** to the ID from Step 2.6
4. Save the configuration

### Step 4: Test Installation
1. Click the MDW Tube extension icon
2. Click **Sign in with Google**
3. Grant necessary permissions
4. You should see your subscribed channels load

## 📱 Usage Guide

### Getting Started
1. **Sign In**: Click the extension icon and sign in with your Google account
2. **Configure Channels**: Go to the "Channels" tab and toggle which channels you want recommendations from
3. **View Recommendations**: The "Videos" tab shows recent videos from your enabled channels
4. **Manage Playlists**: Use the "Playlists" tab to create and manage your playlists

### Video Management
- **Add to Playlist**: Click the ➕ button on any recommended video
- **Picture-in-Picture**: Click the 📺 button to enable PiP mode
- **Open Video**: Click anywhere on a video item to open it in YouTube

### Playlist Features
- **Create Playlist**: Enter a name in the "Playlists" tab and click "Create"
- **Reorder Videos**: Drag and drop videos in YouTube's playlist page
- **Export Playlist**: Use the export button on any playlist page
- **Visual Shuffle**: Use the shuffle button for quick reordering

### Advanced Settings
Access settings through the extension popup:
- **Auto-PiP**: Automatically enable Picture-in-Picture on video play
- **Video Limit**: Set number of videos to load per channel (5-20)
- **Update Frequency**: How often to refresh recommendations

## 🎮 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` | Toggle Picture-in-Picture |
| `Ctrl+Shift+M` | Open MDW Tube popup |
| `Esc` | Close extension popup |

## 🔧 Troubleshooting

### Authentication Issues
- **Error: Authorization page could not be loaded**
  - Check that Extension ID matches in Google Cloud Console
  - Ensure OAuth client type is set to "Chrome extension"
  - Verify YouTube Data API v3 is enabled

### No Videos Loading
- Check internet connection
- Verify you have subscribed channels
- Enable at least one channel in the Channels tab
- Check if your YouTube API quota is exceeded

### Picture-in-Picture Not Working
- Ensure you're on a video page (youtube.com/watch)
- Check if your browser supports PiP (Chrome 88+)
- Try refreshing the page and clicking the PiP button again

### Playlist Features Not Working
- Make sure you're signed in with the correct Google account
- Check that you have permission to edit the playlist
- Verify the playlist is not set to private/restricted

## 🛠️ Development

### File Structure
```
mdw-tube/
├── manifest.json          # Extension manifest
├── background.js          # Service worker
├── popup.html            # Popup interface
├── popup.js              # Popup logic
├── content.js            # YouTube page integration
├── content.css           # Custom styles
└── icons/                # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Key Components
- **Background Script**: Handles YouTube API calls and authentication
- **Popup Interface**: Main user interface with tabs and controls
- **Content Script**: Integrates with YouTube pages for PiP and playlist features
- **CSS Styling**: Modern, responsive design with smooth animations

### API Integration
- **YouTube Data API v3**: For playlist and subscription management
- **Chrome Identity API**: For OAuth authentication
- **Chrome Storage API**: For settings and preferences
- **Chrome Tabs API**: For opening videos and managing PiP

## 🎨 Customization

### Themes
The extension supports both light and dark themes, automatically adapting to your system preferences.

### Custom CSS
You can modify `content.css` to customize the appearance:
- Change color scheme by updating CSS variables
- Modify button styles and animations
- Adjust spacing and layout

### API Limits
- **Default quota**: 10,000 units per day
- **Typical usage**: ~100 units per session
- **Rate limiting**: Automatically handled by the extension

## 🔒 Privacy & Security

### Data Collection
- **No personal data stored**: Only YouTube API responses are cached temporarily
- **Local storage only**: All settings stored in Chrome's local storage
- **No external servers**: Direct communication with YouTube API only

### Permissions Explained
- **Identity**: Required for Google OAuth authentication
- **Storage**: For saving settings and preferences
- **ActiveTab**: To integrate with YouTube pages
- **YouTube API access**: For playlist and subscription management

## 📞 Support

### Getting Help
- Check the troubleshooting section above
- Review Chrome extension developer documentation
- Check YouTube Data API v3 documentation

### Known Limitations
- YouTube API quota limits (10,000 units/day)
- Some playlist operations require page refresh
- PiP availability depends on browser support
- Drag & drop works best on desktop Chrome

## 🎯 Roadmap

### Version 1.1 (Coming Soon)
- [ ] Batch video operations
- [ ] Custom keyboard shortcuts
- [ ] Playlist templates
- [ ] Video quality preferences

### Version 1.2 (Future)
- [ ] Collaborative playlists
- [ ] Advanced filtering options
- [ ] Integration with other music services
- [ ] Mobile browser support

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please read the contributing guidelines before submitting pull requests.

---

**MDW Tube** - Making YouTube playlist management smarter and more efficient! 🎵