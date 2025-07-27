// content.js - Content Script for YouTube integration
class MDWTubeContent {
    constructor() {
      this.observer = null;
      this.pipButton = null;
      this.currentVideo = null;
      this.init();
    }
  
    init() {
      // Wait for page to load
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setup());
      } else {
        this.setup();
      }
    }
  
    setup() {
      // Listen for navigation changes (YouTube is SPA)
      this.observeUrlChanges();
      
      // Initialize on current page
      this.handlePageChange();
      
      // Listen for messages from popup/background
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        this.handleMessage(request, sender, sendResponse);
      });
    }
  
    observeUrlChanges() {
      let currentUrl = location.href;
      
      // Override pushState and replaceState to detect navigation
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = function(...args) {
        originalPushState.apply(history, args);
        setTimeout(() => {
          if (location.href !== currentUrl) {
            currentUrl = location.href;
            mdwContent.handlePageChange();
          }
        }, 100);
      };
      
      history.replaceState = function(...args) {
        originalReplaceState.apply(history, args);
        setTimeout(() => {
          if (location.href !== currentUrl) {
            currentUrl = location.href;
            mdwContent.handlePageChange();
          }
        }, 100);
      };
      
      // Also listen for popstate events
      window.addEventListener('popstate', () => {
        setTimeout(() => {
          if (location.href !== currentUrl) {
            currentUrl = location.href;
            this.handlePageChange();
          }
        }, 100);
      });
    }
  
    handlePageChange() {
      const url = location.href;
      
      if (url.includes('/watch?v=')) {
        // On video watch page
        this.setupVideoPage();
      } else if (url.includes('/playlist?list=')) {
        // On playlist page
        this.setupPlaylistPage();
      } else {
        // Other pages, cleanup
        this.cleanup();
      }
    }
  
    setupVideoPage() {
      // Wait for video player to load
      const checkVideo = () => {
        const video = document.querySelector('video');
        if (video) {
          this.currentVideo = video;
          this.addPiPButton();
          this.setupVideoEvents();
        } else {
          setTimeout(checkVideo, 500);
        }
      };
      
      checkVideo();
    }
  
    addPiPButton() {
      // Remove existing button if any
      if (this.pipButton) {
        this.pipButton.remove();
      }
  
      // Find YouTube's control bar
      const controlsContainer = document.querySelector('.ytp-right-controls');
      if (!controlsContainer) {
        setTimeout(() => this.addPiPButton(), 500);
        return;
      }
  
      // Create PiP button
      this.pipButton = document.createElement('button');
      this.pipButton.className = 'ytp-button mdw-pip-button';
      this.pipButton.title = 'Picture in Picture (MDW Tube)';
      this.pipButton.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/>
        </svg>
      `;
  
      // Style the button to match YouTube's design
      this.pipButton.style.cssText = `
        background: transparent;
        border: none;
        color: white;
        cursor: pointer;
        padding: 8px;
        margin: 0 4px;
        border-radius: 2px;
        opacity: 0.9;
        transition: opacity 0.2s;
      `;
  
      this.pipButton.addEventListener('mouseenter', () => {
        this.pipButton.style.opacity = '1';
      });
  
      this.pipButton.addEventListener('mouseleave', () => {
        this.pipButton.style.opacity = '0.9';
      });
  
      this.pipButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.togglePictureInPicture();
      });
  
      // Insert before the fullscreen button
      const fullscreenButton = controlsContainer.querySelector('.ytp-fullscreen-button');
      if (fullscreenButton) {
        controlsContainer.insertBefore(this.pipButton, fullscreenButton);
      } else {
        controlsContainer.appendChild(this.pipButton);
      }
    }
  
    setupVideoEvents() {
      if (!this.currentVideo) return;
  
      // Auto-enable PiP on play (optional feature)
      const handlePlay = () => {
        // Check if auto-PiP is enabled in settings
        chrome.storage.local.get(['mdw_auto_pip'], (result) => {
          if (result.mdw_auto_pip) {
            setTimeout(() => this.enablePictureInPicture(), 1000);
          }
        });
      };
  
      // Remove existing listeners
      this.currentVideo.removeEventListener('play', handlePlay);
      
      // Add new listeners
      this.currentVideo.addEventListener('play', handlePlay);
    }
  
    setupPlaylistPage() {
      // Add drag and drop functionality to playlist items
      this.setupPlaylistDragDrop();
      
      // Add MDW Tube controls to playlist
      this.addPlaylistControls();
    }
  
    setupPlaylistDragDrop() {
      const playlistItems = document.querySelectorAll('#playlist #contents ytd-playlist-video-renderer');
      
      playlistItems.forEach((item, index) => {
        if (item.hasAttribute('mdw-drag-enabled')) return;
        
        item.setAttribute('mdw-drag-enabled', 'true');
        item.draggable = true;
        
        item.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', index);
          item.style.opacity = '0.5';
        });
        
        item.addEventListener('dragend', (e) => {
          item.style.opacity = '1';
        });
        
        item.addEventListener('dragover', (e) => {
          e.preventDefault();
        });
        
        item.addEventListener('drop', (e) => {
          e.preventDefault();
          const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
          const targetIndex = index;
          
          if (draggedIndex !== targetIndex) {
            this.reorderPlaylistItems(draggedIndex, targetIndex);
          }
        });
      });
    }
  
    addPlaylistControls() {
      // Find playlist header
      const playlistHeader = document.querySelector('#playlist #header');
      if (!playlistHeader || playlistHeader.querySelector('.mdw-playlist-controls')) {
        return;
      }
  
      // Create controls container
      const controlsContainer = document.createElement('div');
      controlsContainer.className = 'mdw-playlist-controls';
      controlsContainer.style.cssText = `
        margin: 10px 0;
        padding: 10px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        display: flex;
        gap: 10px;
        align-items: center;
      `;
  
      // Add shuffle button
      const shuffleBtn = document.createElement('button');
      shuffleBtn.textContent = '🔀 MDW Shuffle';
      shuffleBtn.className = 'mdw-control-btn';
      shuffleBtn.addEventListener('click', () => this.shufflePlaylist());
  
      // Add export button
      const exportBtn = document.createElement('button');
      exportBtn.textContent = '📤 Export';
      exportBtn.className = 'mdw-control-btn';
      exportBtn.addEventListener('click', () => this.exportPlaylist());
  
      // Style buttons
      [shuffleBtn, exportBtn].forEach(btn => {
        btn.style.cssText = `
          background: #ff0000;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.2s;
        `;
        
        btn.addEventListener('mouseenter', () => {
          btn.style.background = '#cc0000';
        });
        
        btn.addEventListener('mouseleave', () => {
          btn.style.background = '#ff0000';
        });
      });
  
      controlsContainer.appendChild(shuffleBtn);
      controlsContainer.appendChild(exportBtn);
      
      playlistHeader.appendChild(controlsContainer);
    }
  
    async togglePictureInPicture() {
      if (document.pictureInPictureElement) {
        // Exit PiP
        await document.exitPictureInPicture();
      } else {
        // Enter PiP
        await this.enablePictureInPicture();
      }
    }
  
    async enablePictureInPicture() {
      const video = this.currentVideo || document.querySelector('video');
      
      if (!video) {
        console.error('No video element found');
        return;
      }
  
      try {
        if (document.pictureInPictureEnabled) {
          await video.requestPictureInPicture();
          
          // Update button state
          if (this.pipButton) {
            this.pipButton.style.background = 'rgba(255, 255, 255, 0.2)';
          }
          
          // Listen for PiP exit
          video.addEventListener('leavepictureinpicture', () => {
            if (this.pipButton) {
              this.pipButton.style.background = 'transparent';
            }
          }, { once: true });
          
        } else {
          console.warn('Picture-in-Picture not supported');
        }
      } catch (error) {
        console.error('Failed to enable Picture-in-Picture:', error);
      }
    }
  
    async reorderPlaylistItems(fromIndex, toIndex) {
      // Get playlist ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      const playlistId = urlParams.get('list');
      
      if (!playlistId) return;
  
      try {
        // Get playlist items to find the item ID
        const response = await this.sendMessage({
          action: 'getPlaylistItems',
          playlistId: playlistId
        });
  
        if (response.success && response.data[fromIndex]) {
          const itemId = response.data[fromIndex].id;
          
          await this.sendMessage({
            action: 'reorderPlaylistItem',
            playlistItemId: itemId,
            newPosition: toIndex
          });
  
          // Refresh the page to show changes
          setTimeout(() => location.reload(), 500);
        }
      } catch (error) {
        console.error('Error reordering playlist items:', error);
      }
    }
  
    shufflePlaylist() {
      // Simple visual shuffle for demo
      const container = document.querySelector('#playlist #contents');
      if (!container) return;
  
      const items = Array.from(container.children);
      const shuffled = items.sort(() => Math.random() - 0.5);
      
      // Re-append in shuffled order
      shuffled.forEach(item => container.appendChild(item));
      
      // Note: This is just visual. For real shuffle, would need to use YouTube's API
      this.showNotification('Playlist shuffled! (Visual only - refresh to restore order)');
    }
  
    async exportPlaylist() {
      const urlParams = new URLSearchParams(window.location.search);
      const playlistId = urlParams.get('list');
      
      if (!playlistId) return;
  
      try {
        const response = await this.sendMessage({
          action: 'getPlaylistItems',
          playlistId: playlistId
        });
  
        if (response.success) {
          const playlistData = {
            id: playlistId,
            url: window.location.href,
            items: response.data,
            exportedAt: new Date().toISOString()
          };
  
          // Create download
          const blob = new Blob([JSON.stringify(playlistData, null, 2)], {
            type: 'application/json'
          });
          
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `mdw-tube-playlist-${playlistId}.json`;
          a.click();
          
          URL.revokeObjectURL(url);
          
          this.showNotification('Playlist exported successfully!');
        }
      } catch (error) {
        console.error('Error exporting playlist:', error);
        this.showNotification('Error exporting playlist');
      }
    }
  
    showNotification(message) {
      // Create notification element
      const notification = document.createElement('div');
      notification.textContent = message;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff0000;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
      `;
  
      // Add animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      
      if (!document.querySelector('#mdw-notification-styles')) {
        style.id = 'mdw-notification-styles';
        document.head.appendChild(style);
      }
  
      document.body.appendChild(notification);
  
      // Auto remove after 3 seconds
      setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }, 3000);
    }
  
    handleMessage(request, sender, sendResponse) {
      switch (request.action) {
        case 'enablePictureInPicture':
          this.enablePictureInPicture();
          sendResponse({ success: true });
          break;
          
        case 'getVideoInfo':
          const videoInfo = this.getCurrentVideoInfo();
          sendResponse({ success: true, data: videoInfo });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    }
  
    getCurrentVideoInfo() {
      const video = document.querySelector('video');
      const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer');
      const channelElement = document.querySelector('#owner-name a');
      
      return {
        videoId: this.getVideoIdFromUrl(),
        title: titleElement ? titleElement.textContent.trim() : '',
        channel: channelElement ? channelElement.textContent.trim() : '',
        currentTime: video ? video.currentTime : 0,
        duration: video ? video.duration : 0,
        paused: video ? video.paused : true
      };
    }
  
    getVideoIdFromUrl() {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('v');
    }
  
    sendMessage(message) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, resolve);
      });
    }
  
    cleanup() {
      // Remove custom elements when leaving video/playlist pages
      if (this.pipButton) {
        this.pipButton.remove();
        this.pipButton = null;
      }
  
      const mdwControls = document.querySelectorAll('.mdw-playlist-controls');
      mdwControls.forEach(control => control.remove());
  
      // Remove drag attributes
      const dragItems = document.querySelectorAll('[mdw-drag-enabled]');
      dragItems.forEach(item => {
        item.removeAttribute('mdw-drag-enabled');
        item.draggable = false;
      });
    }
  }
  
  // Initialize content script
  let mdwContent;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      mdwContent = new MDWTubeContent();
    });
  } else {
    mdwContent = new MDWTubeContent();
  }