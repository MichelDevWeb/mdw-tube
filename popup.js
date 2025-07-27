// popup.js - MDW Tube Popup Interface
class MDWTubePopup {
    constructor() {
        this.currentTab = 'recommendations';
        this.enabledChannels = new Set();
        this.currentPlaylist = null;
        this.subscriptions = [];
        this.playlists = [];
        this.isAuthenticated = false;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.checkAuthStatus();
        this.loadInitialData();
    }

    setupEventListeners() {
        // Auth buttons
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Create playlist
        document.getElementById('createPlaylistBtn').addEventListener('click', () => this.createPlaylist());
        document.getElementById('playlistTitle').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createPlaylist();
        });

        // Global error handling
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
            this.showStatus('An error occurred. Please try again.', 'error');
        });
    }

    async checkAuthStatus() {
        try {
            const response = await this.sendMessage({ action: 'authenticate' });
            if (response.success) {
                this.isAuthenticated = true;
                this.showLoggedInState();
                this.showStatus('Authentication successful', 'success');
            } else {
                this.isAuthenticated = false;
                this.showLoggedOutState();
                this.showStatus('Please sign in to YouTube', 'info');
            }
        } catch (error) {
            console.error('Auth check error:', error);
            this.isAuthenticated = false;
            this.showLoggedOutState();
            this.showStatus('Authentication check failed', 'error');
        }
    }

    async login() {
        const loginBtn = document.getElementById('loginBtn');
        
        try {
            loginBtn.disabled = true;
            this.showStatus('Signing in...', 'info');

            const response = await this.sendMessage({ action: 'authenticate' });
            
            if (response.success) {
                this.isAuthenticated = true;
                this.showStatus('Sign in successful!', 'success');
                this.showLoggedInState();
                await this.loadInitialData();
            } else {
                throw new Error(response.error || 'Authentication failed');
            }
            
        } catch (error) {
            console.error('Login error:', error);
            this.showStatus(`Error: ${error.message}`, 'error');
            this.showLoggedOutState();
        } finally {
            loginBtn.disabled = false;
        }
    }

    async logout() {
        try {
            const logoutBtn = document.getElementById('logoutBtn');
            logoutBtn.disabled = true;
            this.showStatus('Signing out...', 'info');

            // Revoke the Google OAuth token
            try {
                await this.sendMessage({ action: 'revokeToken' });
            } catch (error) {
                console.warn('Token revocation failed:', error);
                // Continue with logout even if revocation fails
            }

            // Clear Chrome identity cache
            try {
                await new Promise((resolve, reject) => {
                    chrome.identity.clearAllCachedAuthTokens(() => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve();
                        }
                    });
                });
            } catch (error) {
                console.warn('Clear cached tokens failed:', error);
            }

            // Clear local storage
            await chrome.storage.local.clear();
            
            this.isAuthenticated = false;
            this.showLoggedOutState();
            this.showStatus('Signed out successfully', 'success');
            this.clearData();
            
        } catch (error) {
            console.error('Logout error:', error);
            this.showStatus('Logout failed', 'error');
        } finally {
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) logoutBtn.disabled = false;
        }
    }

    async loadInitialData() {
        if (!this.isAuthenticated) {
            this.showStatus('Please sign in first', 'warning');
            return;
        }

        try {
            this.showStatus('Loading subscriptions...', 'info');
            
            // Load subscriptions
            const subResponse = await this.sendMessage({ action: 'getSubscriptions' });
            if (subResponse.success) {
                this.subscriptions = subResponse.data;
                this.showStatus(`Loaded ${this.subscriptions.length} subscriptions`, 'success');
                this.renderSubscriptions();
            } else {
                throw new Error(subResponse.error || 'Failed to load subscriptions');
            }

            // Load playlists
            const playlistResponse = await this.sendMessage({ action: 'getPlaylists' });
            if (playlistResponse.success) {
                this.playlists = playlistResponse.data;
                this.renderPlaylists();
            }

        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showStatus('Failed to load data', 'error');
        }
    }

    async loadEnabledChannels() {
        if (!this.isAuthenticated) return;

        try {
            // Load enabled channels from storage
            const result = await chrome.storage.local.get(['enabledChannels']);
            if (result.enabledChannels) {
                this.enabledChannels = new Set(result.enabledChannels);
            }
            this.renderSubscriptions();
        } catch (error) {
            console.error('Error loading enabled channels:', error);
        }
    }

    async saveEnabledChannels() {
        try {
            await chrome.storage.local.set({
                enabledChannels: Array.from(this.enabledChannels)
            });
        } catch (error) {
            console.error('Error saving enabled channels:', error);
        }
    }

    switchTab(tabName) {
        if (this.currentTab === tabName) return;

        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');

        this.currentTab = tabName;

        // Load tab-specific data
        switch (tabName) {
            case 'recommendations':
                this.loadRecommendations();
                break;
            case 'playlists':
                this.loadPlaylists();
                break;
            case 'channels':
                this.loadEnabledChannels();
                break;
        }
    }

    async loadRecommendations() {
        if (!this.isAuthenticated || this.enabledChannels.size === 0) {
            document.getElementById('recommendationsContent').innerHTML = 
                '<div class="empty-state">Enable some channels first</div>';
            return;
        }

        try {
            this.showStatus('Loading recommendations...', 'info');
            const enabledChannelIds = Array.from(this.enabledChannels);
            const videos = [];

            // Load videos from enabled channels
            for (const channelId of enabledChannelIds) {
                const response = await this.sendMessage({ 
                    action: 'getChannelVideos', 
                    channelId: channelId,
                    limit: 5
                });
                
                if (response.success) {
                    videos.push(...response.data);
                }
            }

            this.renderRecommendations(videos);
            this.showStatus(`Loaded ${videos.length} recommendations`, 'success');

        } catch (error) {
            console.error('Error loading recommendations:', error);
            this.showStatus('Failed to load recommendations', 'error');
        }
    }

    async loadPlaylists() {
        if (!this.isAuthenticated) return;

        try {
            const response = await this.sendMessage({ action: 'getPlaylists' });
            if (response.success) {
                this.playlists = response.data;
                this.renderPlaylists();
            }
        } catch (error) {
            console.error('Error loading playlists:', error);
        }
    }

    async createPlaylist() {
        const titleInput = document.getElementById('playlistTitle');
        const title = titleInput.value.trim();
        
        if (!title) {
            this.showStatus('Please enter a playlist title', 'warning');
            return;
        }

        try {
            this.showStatus('Creating playlist...', 'info');
            
            const response = await this.sendMessage({
                action: 'createPlaylist',
                title: title,
                description: `Created by MDW Tube on ${new Date().toLocaleDateString()}`
            });

            if (response.success) {
                this.showStatus('Playlist created successfully!', 'success');
                titleInput.value = '';
                await this.loadPlaylists();
            } else {
                throw new Error(response.error || 'Failed to create playlist');
            }

        } catch (error) {
            console.error('Error creating playlist:', error);
            this.showStatus('Failed to create playlist', 'error');
        }
    }

    renderSubscriptions() {
        const container = document.getElementById('channelsContent');
        if (!container) return;

        if (this.subscriptions.length === 0) {
            container.innerHTML = '<div class="empty-state">No subscriptions found</div>';
            return;
        }

        container.innerHTML = this.subscriptions.map(sub => `
            <div class="channel-item">
                <img class="channel-thumbnail" src="${sub.thumbnail}" alt="${this.escapeHtml(sub.title)}">
                <div class="channel-info">
                    <div class="channel-title">${this.escapeHtml(sub.title)}</div>
                    <div class="channel-description">${this.escapeHtml(sub.description || '')}</div>
                </div>
                <label class="channel-toggle">
                    <input type="checkbox" ${this.enabledChannels.has(sub.channelId) ? 'checked' : ''} 
                           data-channel-id="${sub.channelId}">
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `).join('');

        // Add event listeners for toggles
        container.querySelectorAll('.channel-toggle input').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const channelId = e.target.dataset.channelId;
                if (e.target.checked) {
                    this.enabledChannels.add(channelId);
                } else {
                    this.enabledChannels.delete(channelId);
                }
                this.saveEnabledChannels();
            });
        });

        // Add error handling for images
        container.querySelectorAll('.channel-thumbnail').forEach(img => {
            img.addEventListener('error', () => {
                img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNmNWY1ZjUiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDMTMuMSAyIDE0IDIuOSAxNCA0VjEyQzE0IDEzLjEgMTMuMSAxNCAxMiAxNEMxMC45IDE0IDEwIDEzLjEgMTAgMTJWNEMxMCAyLjkgMTAuOSAyIDEyIDJaTTIxIDEyQzIxIDEzLjEgMjAuMSAxNSAxOSAxNkgxN0MxNi4xIDE1IDE1IDE0LjMgMTUgMTNWMTFIMTNWMTNDMTMgMTQuMyAxMi4xIDE1IDExIDE1SDlDOC4xIDE1IDcuMSAxNC4xIDcgMTNMMTEgMTBWOEMxMSA2LjkgMTEuOSA2IDEzIDZIMTVDMTYuMSA2IDE3IDYuOSAxNyA4VjEwTDIxIDEyWiIgZmlsbD0iIzk5OTk5OSIvPgo8L3N2Zz4KPC9zdmc+';
            });
        });
    }

    renderRecommendations(videos) {
        const container = document.getElementById('recommendationsContent');
        if (!container) return;

        if (videos.length === 0) {
            container.innerHTML = '<div class="empty-state">No recommendations available</div>';
            return;
        }

        container.innerHTML = videos.map(video => `
            <div class="video-item" data-video-id="${video.videoId}">
                <img class="video-thumbnail" src="${video.thumbnail}" alt="${this.escapeHtml(video.title)}">
                <div class="video-info">
                    <div class="video-title">${this.escapeHtml(video.title)}</div>
                    <div class="video-channel">${this.escapeHtml(video.channelTitle)}</div>
                    <div class="video-published">${this.formatDate(video.publishedAt)}</div>
                </div>
                <div class="video-actions">
                    <button class="btn btn-primary watch-btn" data-video-id="${video.videoId}">
                        Watch
                    </button>
                    <button class="btn btn-secondary add-to-playlist-btn" data-video-id="${video.videoId}">
                        Add to Playlist
                    </button>
                </div>
            </div>
        `).join('');

        // Add event listeners for video actions
        container.querySelectorAll('.watch-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const videoId = e.target.dataset.videoId;
                window.open(`https://youtube.com/watch?v=${videoId}`, '_blank');
            });
        });

        container.querySelectorAll('.add-to-playlist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const videoId = e.target.dataset.videoId;
                this.showPlaylistSelector(videoId);
            });
        });

        // Add error handling for video thumbnails
        container.querySelectorAll('.video-thumbnail').forEach(img => {
            img.addEventListener('error', () => {
                img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNDUiIHZpZXdCb3g9IjAgMCA4MCA0NSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjQ1IiBmaWxsPSIjZjVmNWY1Ii8+Cjx0ZXh0IHg9IjQwIiB5PSIyNSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4=';
            });
        });
    }

    renderPlaylists() {
        const container = document.getElementById('playlistsContent');
        if (!container) return;

        if (this.playlists.length === 0) {
            container.innerHTML = '<div class="empty-state">No playlists found</div>';
            return;
        }

        container.innerHTML = this.playlists.map(playlist => `
            <div class="playlist-item" data-playlist-id="${playlist.id}">
                <img class="playlist-thumbnail" src="${playlist.thumbnail || '/icons/icon48.png'}" alt="${this.escapeHtml(playlist.title)}">
                <div class="playlist-info">
                    <div class="playlist-title">${this.escapeHtml(playlist.title)}</div>
                    <div class="playlist-description">${this.escapeHtml(playlist.description || '')}</div>
                    <div class="playlist-count">${playlist.itemCount} videos</div>
                </div>
                <div class="playlist-actions">
                    <button class="btn btn-primary view-playlist-btn external-link" data-playlist-id="${playlist.id}">
                        View
                    </button>
                    <button class="btn btn-secondary manage-playlist-btn" data-playlist-id="${playlist.id}">
                        Manage
                    </button>
                </div>
            </div>
        `).join('');

        // Add event listeners for playlist actions
        container.querySelectorAll('.view-playlist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const playlistId = e.target.dataset.playlistId;
                window.open(`https://youtube.com/playlist?list=${playlistId}`, '_blank');
            });
        });

        container.querySelectorAll('.manage-playlist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const playlistId = e.target.dataset.playlistId;
                this.viewPlaylistItems(playlistId);
            });
        });

        // Add error handling for playlist thumbnails
        container.querySelectorAll('.playlist-thumbnail').forEach(img => {
            img.addEventListener('error', () => {
                img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNDUiIHZpZXdCb3g9IjAgMCA4MCA0NSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjQ1IiBmaWxsPSIjZjVmNWY1Ii8+Cjx0ZXh0IHg9IjQwIiB5PSIyNSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiPlBsYXlsaXN0PC90ZXh0Pgo8L3N2Zz4=';
            });
        });
    }

    async showPlaylistSelector(videoId) {
        if (this.playlists.length === 0) {
            this.showStatus('No playlists available. Create one first.', 'warning');
            return;
        }

        // Simple prompt for now - could be enhanced with a modal
        const playlistNames = this.playlists.map((p, i) => `${i + 1}. ${p.title}`).join('\n');
        const selection = prompt(`Select playlist:\n${playlistNames}\n\nEnter number:`);
        
        if (selection) {
            const index = parseInt(selection) - 1;
            if (index >= 0 && index < this.playlists.length) {
                await this.addVideoToPlaylist(this.playlists[index].id, videoId);
            }
        }
    }

    async addVideoToPlaylist(playlistId, videoId) {
        try {
            this.showStatus('Adding video to playlist...', 'info');
            
            const response = await this.sendMessage({
                action: 'addVideoToPlaylist',
                playlistId: playlistId,
                videoId: videoId
            });

            if (response.success) {
                this.showStatus('Video added to playlist!', 'success');
            } else {
                throw new Error(response.error || 'Failed to add video');
            }

        } catch (error) {
            console.error('Error adding video to playlist:', error);
            this.showStatus('Failed to add video to playlist', 'error');
        }
    }

    async viewPlaylistItems(playlistId) {
        try {
            const response = await this.sendMessage({
                action: 'getPlaylistItems',
                playlistId: playlistId
            });

            if (response.success) {
                // For now, just log the items - could be enhanced with a detailed view
                console.log('Playlist items:', response.data);
                this.showStatus(`Playlist has ${response.data.length} items`, 'info');
            }

        } catch (error) {
            console.error('Error loading playlist items:', error);
            this.showStatus('Failed to load playlist items', 'error');
        }
    }

    showLoggedInState() {
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('logoutBtn').style.display = 'block';
        document.getElementById('mainContent').style.display = 'block';
    }

    showLoggedOutState() {
        document.getElementById('loginBtn').style.display = 'block';
        document.getElementById('loginBtn').disabled = false;
        document.getElementById('logoutBtn').style.display = 'none';
        document.getElementById('mainContent').style.display = 'none';
    }

    clearData() {
        this.subscriptions = [];
        this.playlists = [];
        this.enabledChannels.clear();
        
        // Clear UI
        ['recommendationsContent', 'playlistsContent', 'channelsContent'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.innerHTML = '';
        });
    }

    showStatus(message, type = 'info') {
        const statusElement = document.getElementById('status');
        if (!statusElement) return;

        statusElement.textContent = message;
        statusElement.className = `status ${type}`;
        
        // Auto-clear status after 3 seconds for non-error messages
        if (type !== 'error') {
            setTimeout(() => {
                statusElement.textContent = '';
                statusElement.className = 'status';
            }, 3000);
        }
    }

    sendMessage(message) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    resolve(response || { success: false, error: 'No response' });
                }
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    formatDate(dateString) {
        try {
            return new Date(dateString).toLocaleDateString();
        } catch {
            return 'Unknown date';
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MDWTubePopup();
}); 