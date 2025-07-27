// background.js - Enhanced Service Worker for MDW Tube
const CLIENT_ID = '362844435268-rb8vufp6gsh7gslsru82fuo6kgptfi7t.apps.googleusercontent.com';
const SCOPES = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.force-ssl'
];

class MDWTubeManager {
  constructor() {
    this.accessToken = null;
    this.cache = new Map();
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open
    });

    // Initialize on startup
    this.loadStoredToken();
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'authenticate':
          const token = await this.authenticate();
          sendResponse({ success: true, token });
          break;

        case 'revokeToken':
          await this.revokeToken();
          sendResponse({ success: true });
          break;

        case 'getUserInfo':
          const userInfo = await this.getUserInfo();
          sendResponse({ success: true, data: userInfo });
          break;

        case 'getSubscriptions':
          const subscriptions = await this.getSubscriptions();
          sendResponse({ success: true, data: subscriptions });
          break;

        case 'getChannelVideos':
          const videos = await this.getChannelVideos(request.channelId, request.limit);
          sendResponse({ success: true, data: videos });
          break;

        case 'createPlaylist':
          const playlist = await this.createPlaylist(request.title, request.description);
          sendResponse({ success: true, data: playlist });
          break;

        case 'deletePlaylist':
          await this.deletePlaylist(request.playlistId);
          sendResponse({ success: true });
          break;

        case 'addVideoToPlaylist':
          await this.addVideoToPlaylist(request.playlistId, request.videoId, request.position);
          sendResponse({ success: true });
          break;

        case 'removeVideoFromPlaylist':
          await this.removeVideoFromPlaylist(request.playlistItemId);
          sendResponse({ success: true });
          break;

        case 'reorderPlaylistItem':
          await this.reorderPlaylistItem(request.playlistItemId, request.newPosition);
          sendResponse({ success: true });
          break;

        case 'getPlaylists':
          const playlists = await this.getPlaylists();
          sendResponse({ success: true, data: playlists });
          break;

        case 'getPlaylistItems':
          const items = await this.getPlaylistItems(request.playlistId);
          sendResponse({ success: true, data: items });
          break;

        case 'getWatchHistory':
          const history = await this.getWatchHistory();
          sendResponse({ success: true, data: history });
          break;

        case 'enablePictureInPicture':
          this.enablePictureInPicture(sender.tab.id);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // Authentication methods
  async authenticate() {
    try {
      const token = await this.getAuthToken();
      if (token) {
        this.accessToken = token;
        await this.saveToken(token);
        return token;
      }
      throw new Error('No token received');
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  }

  async getAuthToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ 
        interactive: true,
        scopes: SCOPES 
      }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(token);
        }
      });
    });
  }

  async revokeToken() {
    try {
      if (this.accessToken) {
        // Revoke the token with Google
        try {
          const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${this.accessToken}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });
          
          if (!response.ok) {
            console.warn('Token revocation response not OK:', response.status);
          }
        } catch (error) {
          console.warn('Failed to revoke token with Google:', error);
        }

        // Remove cached token from Chrome identity
        return new Promise((resolve) => {
          chrome.identity.removeCachedAuthToken({ token: this.accessToken }, () => {
            this.accessToken = null;
            resolve();
          });
        });
      }
    } catch (error) {
      console.error('Error revoking token:', error);
      throw error;
    }
  }

  async getUserInfo() {
    const cacheKey = 'userInfo';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const data = await this.makeYouTubeRequest('channels', {
      part: 'snippet,statistics',
      mine: 'true'
    });

    if (data.items && data.items.length > 0) {
      const channel = data.items[0];
      const userInfo = {
        id: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        thumbnail: channel.snippet.thumbnails.default.url,
        subscriberCount: channel.statistics.subscriberCount,
        videoCount: channel.statistics.videoCount,
        viewCount: channel.statistics.viewCount
      };

      this.cache.set(cacheKey, userInfo);
      setTimeout(() => this.cache.delete(cacheKey), 300000); // Cache for 5 minutes

      return userInfo;
    }

    return null;
  }

  // YouTube API methods
  async makeYouTubeRequest(endpoint, params = {}) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }

    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, clear it
        this.accessToken = null;
        await chrome.storage.local.remove(['youtube_access_token']);
        throw new Error('Authentication expired. Please sign in again.');
      }
      throw new Error(`YouTube API error: ${response.status}`);
    }

    return response.json();
  }

  async getSubscriptions() {
    const cacheKey = 'subscriptions';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const data = await this.makeYouTubeRequest('subscriptions', {
      part: 'snippet',
      mine: 'true',
      maxResults: 50
    });

    const subscriptions = data.items.map(item => ({
      channelId: item.snippet.resourceId.channelId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.default.url,
      description: item.snippet.description
    }));

    // Get additional channel details (subscriber count)
    if (subscriptions.length > 0) {
      const channelIds = subscriptions.map(sub => sub.channelId).join(',');
      const channelData = await this.makeYouTubeRequest('channels', {
        part: 'statistics',
        id: channelIds
      });

      channelData.items.forEach(channel => {
        const subscription = subscriptions.find(sub => sub.channelId === channel.id);
        if (subscription) {
          subscription.subscriberCount = this.formatNumber(channel.statistics.subscriberCount);
        }
      });
    }

    this.cache.set(cacheKey, subscriptions);
    setTimeout(() => this.cache.delete(cacheKey), 300000); // Cache for 5 minutes

    return subscriptions;
  }

  async getChannelVideos(channelId, limit = 10) {
    const cacheKey = `channel_videos_${channelId}_${limit}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Get channel's uploads playlist
    const channelData = await this.makeYouTubeRequest('channels', {
      part: 'contentDetails',
      id: channelId
    });

    if (!channelData.items.length) {
      return [];
    }

    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

    // Get recent videos from uploads playlist
    const playlistData = await this.makeYouTubeRequest('playlistItems', {
      part: 'snippet',
      playlistId: uploadsPlaylistId,
      maxResults: limit
    });

    const videos = playlistData.items.map(item => ({
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      description: item.snippet.description
    }));

    // Get additional video details (duration, view count)
    if (videos.length > 0) {
      const videoIds = videos.map(video => video.videoId).join(',');
      const videoData = await this.makeYouTubeRequest('videos', {
        part: 'contentDetails,statistics',
        id: videoIds
      });

      videoData.items.forEach(video => {
        const videoItem = videos.find(v => v.videoId === video.id);
        if (videoItem) {
          videoItem.duration = video.contentDetails.duration;
          videoItem.viewCount = video.statistics.viewCount;
        }
      });
    }

    this.cache.set(cacheKey, videos);
    setTimeout(() => this.cache.delete(cacheKey), 180000); // Cache for 3 minutes

    return videos;
  }

  formatNumber(num) {
    if (!num) return '0';
    
    const number = parseInt(num);
    if (number >= 1000000) {
      return Math.floor(number / 1000000) + 'M';
    } else if (number >= 1000) {
      return Math.floor(number / 1000) + 'K';
    }
    return number.toString();
  }

  async createPlaylist(title, description = '') {
    const response = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        snippet: {
          title: title,
          description: description
        },
        status: {
          privacyStatus: 'private'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create playlist: ${response.status}`);
    }

    return response.json();
  }

  async deletePlaylist(playlistId) {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/playlists?id=${playlistId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to delete playlist: ${response.status}`);
    }

    return true;
  }

  async addVideoToPlaylist(playlistId, videoId, position) {
    const response = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        snippet: {
          playlistId: playlistId,
          resourceId: {
            kind: 'youtube#video',
            videoId: videoId
          },
          position: position
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to add video to playlist: ${response.status}`);
    }

    return response.json();
  }

  async removeVideoFromPlaylist(playlistItemId) {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?id=${playlistItemId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    return response.ok;
  }

  async reorderPlaylistItem(playlistItemId, newPosition) {
    // First get the item details
    const itemData = await this.makeYouTubeRequest('playlistItems', {
      part: 'snippet',
      id: playlistItemId
    });

    if (!itemData.items.length) {
      throw new Error('Playlist item not found');
    }

    const item = itemData.items[0];
    
    // Update position
    const response = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: playlistItemId,
        snippet: {
          ...item.snippet,
          position: newPosition
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to reorder playlist item: ${response.status}`);
    }

    return response.json();
  }

  async getPlaylists() {
    const data = await this.makeYouTubeRequest('playlists', {
      part: 'snippet,contentDetails',
      mine: 'true',
      maxResults: 25
    });

    return data.items.map(item => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails?.default?.url,
      itemCount: item.contentDetails.itemCount
    }));
  }

  async getPlaylistItems(playlistId) {
    const data = await this.makeYouTubeRequest('playlistItems', {
      part: 'snippet',
      playlistId: playlistId,
      maxResults: 50
    });

    return data.items.map(item => ({
      id: item.id,
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle,
      position: item.snippet.position
    }));
  }

  async getWatchHistory() {
    // Note: YouTube API doesn't provide watch history directly
    // This would need to be tracked by our extension
    const stored = await this.getStoredData('watchHistory');
    return stored || [];
  }

  // Picture in Picture functionality
  async enablePictureInPicture(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          const video = document.querySelector('video');
          if (video && document.pictureInPictureElement !== video) {
            video.requestPictureInPicture().catch(console.error);
          }
        }
      });
    } catch (error) {
      console.error('PiP error:', error);
    }
  }

  // Storage utilities
  async saveToken(token) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ 'youtube_access_token': token }, resolve);
    });
  }

  async loadStoredToken() {
    const result = await this.getStoredData('youtube_access_token');
    if (result) {
      this.accessToken = result;
    }
  }

  async getStoredData(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
      });
    });
  }

  async setStoredData(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }
}

// Initialize MDW Tube Manager
const mdwTube = new MDWTubeManager();