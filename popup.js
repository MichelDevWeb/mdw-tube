// popup.js - MDW Tube Popup Interface
class MDWTubePopup {
    constructor() {
        this.currentTab = 'recommendations';
        this.enabledChannels = new Set();
        this.channelVideoCount = new Map(); // Store video count per channel
        this.currentPlaylist = null;
        this.subscriptions = [];
        this.playlists = [];
        this.isAuthenticated = false;
        this.userInfo = null;
        this.selectedVideos = new Set();
        this.watchedVideos = new Set();
        this.allVideos = [];
        this.currentVideoModal = null; // Current video in modal
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadWatchedVideos();
        await this.loadChannelVideoCount();
        await this.checkAuthStatus();
    }

    setupEventListeners() {
        // Auth buttons
        document.getElementById('loginBtn').addEventListener('click', () => this.login());

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Create playlist
        document.getElementById('createPlaylistBtn').addEventListener('click', () => this.createPlaylist());
        document.getElementById('playlistTitle').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createPlaylist();
        });

        // Video controls
        document.getElementById('shuffleBtn').addEventListener('click', () => this.shuffleVideos());
        document.getElementById('autoPlaylistBtn').addEventListener('click', () => this.createAutoPlaylist());

        // Multi-select controls
        document.getElementById('addSelectedBtn').addEventListener('click', () => this.addSelectedToPlaylist());
        document.getElementById('clearSelectionBtn').addEventListener('click', () => this.clearSelection());

        // Refresh buttons for tabs
        document.getElementById('refreshVideosBtn').addEventListener('click', () => this.refreshVideos());
        document.getElementById('refreshChannelsBtn').addEventListener('click', () => this.refreshChannels());
        document.getElementById('refreshPlaylistsBtn').addEventListener('click', () => this.refreshPlaylists());

        // Video modal
        document.getElementById('videoModalClose').addEventListener('click', () => this.closeVideoModal());
        document.getElementById('videoModalPlayOverlay').addEventListener('click', () => this.watchVideoFromModal());
        document.getElementById('videoModalWatch').addEventListener('click', () => this.watchVideoFromModal());
        document.getElementById('videoModalPlaylist').addEventListener('click', () => this.addVideoToPlaylistFromModal());
        document.getElementById('videoModalDescriptionToggle').addEventListener('click', () => this.toggleVideoDescription());
        
        // Close video modal when clicking outside
        document.getElementById('videoModal').addEventListener('click', (e) => {
            if (e.target.id === 'videoModal') {
                this.closeVideoModal();
            }
        });

        // Support modal
        document.getElementById('supportBtnHeader').addEventListener('click', () => this.openSupportModal());
        document.getElementById('supportModalClose').addEventListener('click', () => this.closeSupportModal());
        document.getElementById('donateBtn').addEventListener('click', () => this.showDonateInfo());
        
        // Close support modal when clicking outside
        document.getElementById('supportModal').addEventListener('click', (e) => {
            if (e.target.id === 'supportModal') {
                this.closeSupportModal();
            }
        });

        // Close modals with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (document.getElementById('videoModal').classList.contains('active')) {
                    this.closeVideoModal();
                } else if (document.getElementById('supportModal').classList.contains('active')) {
                    this.closeSupportModal();
                }
            }
        });

        // Global error handling
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
            this.showStatus('An error occurred. Please try again.', 'error');
        });
    }

    // Video Modal Methods
    openVideoModal(video) {
        this.currentVideoModal = video;
        
        // Populate video player section
        document.getElementById('videoModalThumbnail').src = video.thumbnail;
        document.getElementById('videoModalDuration').textContent = this.formatDuration(video.duration);
        
        // Populate video info
        document.getElementById('videoModalTitle').textContent = video.title;
        document.getElementById('videoModalViews').textContent = `${this.formatViews(video.viewCount)} views`;
        document.getElementById('videoModalDate').textContent = this.formatDate(video.publishedAt);
        
        // Populate channel info
        const channelName = video.channelTitle || 'Unknown Channel';
        const channelAvatar = channelName.charAt(0).toUpperCase();
        document.getElementById('videoModalChannelAvatar').textContent = channelAvatar;
        document.getElementById('videoModalChannelName').textContent = channelName;
        
        // Get channel subscriber count from subscriptions
        const channelInfo = this.subscriptions.find(sub => sub.title === channelName);
        const subscriberCount = channelInfo?.subscriberCount || 'Unknown subscribers';
        document.getElementById('videoModalChannelSubs').textContent = subscriberCount;
        
        // Set description with Show More/Less functionality
        const description = video.description || 'No description available';
        const descriptionElement = document.getElementById('videoModalDescription');
        descriptionElement.textContent = description;
        
        // Check if description is long enough to need toggle
        if (description.length > 200) {
            descriptionElement.classList.add('has-fade');
            document.getElementById('videoModalDescriptionToggle').style.display = 'block';
        } else {
            descriptionElement.classList.remove('has-fade');
            document.getElementById('videoModalDescriptionToggle').style.display = 'none';
        }
        
        // Reset description state
        descriptionElement.classList.remove('expanded');
        document.getElementById('videoModalDescriptionToggle').textContent = 'Show More';
        
        // Populate stats grid
        document.getElementById('videoModalStatViews').textContent = this.formatViews(video.viewCount);
        document.getElementById('videoModalStatDuration').textContent = this.formatDuration(video.duration);
        
        // Show modal
        document.getElementById('videoModal').classList.add('active');
    }

    closeVideoModal() {
        document.getElementById('videoModal').classList.remove('active');
        this.currentVideoModal = null;
    }

    toggleVideoDescription() {
        const descriptionElement = document.getElementById('videoModalDescription');
        const toggleButton = document.getElementById('videoModalDescriptionToggle');
        
        if (descriptionElement.classList.contains('expanded')) {
            descriptionElement.classList.remove('expanded');
            toggleButton.textContent = 'Show More';
        } else {
            descriptionElement.classList.add('expanded');
            toggleButton.textContent = 'Show Less';
        }
    }

    watchVideoFromModal() {
        if (this.currentVideoModal) {
            this.markVideoAsWatched(this.currentVideoModal.videoId);
            window.open(`https://youtube.com/watch?v=${this.currentVideoModal.videoId}`, '_blank');
            this.closeVideoModal();
        }
    }

    async addVideoToPlaylistFromModal() {
        if (this.currentVideoModal) {
            await this.showPlaylistSelector(this.currentVideoModal.videoId);
            this.closeVideoModal();
        }
    }

    openSupportModal() {
        document.getElementById('supportModal').classList.add('active');
    }

    closeSupportModal() {
        document.getElementById('supportModal').classList.remove('active');
    }

    showDonateInfo() {
        alert('Thank you for considering supporting MDW Tube! 💝\n\nYou can support the development by:\n\n1. ⭐ Rating the extension on Chrome Web Store\n2. 🐛 Reporting bugs on GitHub\n3. 💡 Suggesting new features\n4. 📧 Sending feedback to micheldevweb2020@gmail.com\n\nYour support means the world to us!');
    }

    setLoading(elementId, isLoading, loadingText = 'Loading...') {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (isLoading) {
            element.classList.add('section-loading');
            // Create spinner overlay if it doesn't exist
            if (!element.querySelector('.spinner-overlay')) {
                const spinner = document.createElement('div');
                spinner.className = 'spinner-overlay';
                element.appendChild(spinner);
            }
        } else {
            element.classList.remove('section-loading');
            // Remove spinner overlay
            const spinner = element.querySelector('.spinner-overlay');
            if (spinner) {
                spinner.remove();
            }
        }
    }

    async loadChannelVideoCount() {
        try {
            const result = await chrome.storage.local.get(['channelVideoCount']);
            if (result.channelVideoCount) {
                this.channelVideoCount = new Map(Object.entries(result.channelVideoCount));
            }
        } catch (error) {
            console.error('Error loading channel video count:', error);
        }
    }

    async saveChannelVideoCount() {
        try {
            const countObject = Object.fromEntries(this.channelVideoCount);
            await chrome.storage.local.set({
                channelVideoCount: countObject
            });
        } catch (error) {
            console.error('Error saving channel video count:', error);
        }
    }

    getTotalVideoCount() {
        let total = 0;
        this.enabledChannels.forEach(channelId => {
            total += this.channelVideoCount.get(channelId) || 5;
        });
        return total;
    }

    updateVideoCountDisplay() {
        const display = document.getElementById('videoCountDisplay');
        if (display) {
            const total = this.getTotalVideoCount();
            const enabledCount = this.enabledChannels.size;
            display.textContent = `${total} videos from ${enabledCount} channels`;
        }
    }

    async checkAuthStatus() {
        try {
            this.setLoading('authSection', true, 'Checking authentication...');
            const response = await this.sendMessage({ action: 'authenticate' });
            if (response.success) {
                this.isAuthenticated = true;
                await this.loadUserInfo();
                this.showLoggedInState();
                this.showStatus('Authentication successful', 'success');
                await this.loadInitialData();
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
        } finally {
            this.setLoading('authSection', false);
        }
    }

    async loadUserInfo() {
        try {
            const response = await this.sendMessage({ action: 'getUserInfo' });
            if (response.success) {
                this.userInfo = response.data;
            }
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }

    async login() {
        const loginBtn = document.getElementById('loginBtn');
        
        try {
            loginBtn.disabled = true;
            this.setLoading('authSection', true, 'Signing in...');
            this.showStatus('Signing in...', 'info');

            const response = await this.sendMessage({ action: 'authenticate' });
            
            if (response.success) {
                this.isAuthenticated = true;
                await this.loadUserInfo();
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
            this.setLoading('authSection', false);
        }
    }

    async logout() {
        try {
            this.setLoading('headerRight', true, 'Signing out...');
            this.showStatus('Signing out...', 'info');

            // Revoke the Google OAuth token
            try {
                await this.sendMessage({ action: 'revokeToken' });
            } catch (error) {
                console.warn('Token revocation failed:', error);
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
            this.userInfo = null;
            this.showLoggedOutState();
            this.showStatus('Signed out successfully', 'success');
            this.clearData();
            
        } catch (error) {
            console.error('Logout error:', error);
            this.showStatus('Logout failed', 'error');
        } finally {
            this.setLoading('headerRight', false);
        }
    }

    async loadWatchedVideos() {
        try {
            const result = await chrome.storage.local.get(['watchedVideos']);
            if (result.watchedVideos) {
                this.watchedVideos = new Set(result.watchedVideos);
            }
        } catch (error) {
            console.error('Error loading watched videos:', error);
        }
    }

    async saveWatchedVideos() {
        try {
            await chrome.storage.local.set({
                watchedVideos: Array.from(this.watchedVideos)
            });
        } catch (error) {
            console.error('Error saving watched videos:', error);
        }
    }

    markVideoAsWatched(videoId) {
        this.watchedVideos.add(videoId);
        this.saveWatchedVideos();
    }

    async loadInitialData() {
        if (!this.isAuthenticated) {
            this.showStatus('Please sign in first', 'warning');
            return;
        }

        try {
            this.showStatus('Loading data...', 'info');
            this.setLoading('channelsContent', true, 'Loading channels data...');
            this.setLoading('playlistsContent', true, 'Loading playlists...');
            
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

            // Load enabled channels and then load videos
            await this.loadEnabledChannels();
            
            // Load initial videos if we have enabled channels
            if (this.enabledChannels.size > 0) {
                await this.loadRecommendations();
            }

        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showStatus('Failed to load data', 'error');
        } finally {
            this.setLoading('channelsContent', false);
            this.setLoading('playlistsContent', false);
        }
    }

    async loadEnabledChannels() {
        if (!this.isAuthenticated) return;

        try {
            const result = await chrome.storage.local.get(['enabledChannels']);
            if (result.enabledChannels) {
                this.enabledChannels = new Set(result.enabledChannels);
            }
            this.renderSubscriptions();
            this.updateVideoCountDisplay();
        } catch (error) {
            console.error('Error loading enabled channels:', error);
        }
    }

    async saveEnabledChannels() {
        try {
            await chrome.storage.local.set({
                enabledChannels: Array.from(this.enabledChannels)
            });
            this.updateVideoCountDisplay();
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
                if (this.enabledChannels.size > 0 && this.allVideos.length === 0) {
                    this.loadRecommendations();
                }
                break;
            case 'playlists':
                this.loadPlaylists();
                break;
            case 'channels':
                this.loadEnabledChannels();
                break;
        }
    }

    async loadRecommendations(forceRefresh = false) {
        if (!this.isAuthenticated || this.enabledChannels.size === 0) {
            document.getElementById('recommendationsContent').innerHTML = 
                '<div class="empty-state">Enable some channels first</div>';
            this.updateMultiSelectControls();
            this.updateVideoCountDisplay();
            return;
        }

        try {
            this.setLoading('recommendationsContent', true, 'Loading videos...');
            const statusMessage = forceRefresh ? 'Fetching fresh videos from API...' : 'Loading recommendations...';
            this.showStatus(statusMessage, 'info');
            const enabledChannelIds = Array.from(this.enabledChannels);
            const videos = [];

            // Load videos from enabled channels using per-channel video count
            for (const channelId of enabledChannelIds) {
                const videoCount = this.channelVideoCount.get(channelId) || 5;
                const response = await this.sendMessage({ 
                    action: 'getChannelVideos', 
                    channelId: channelId,
                    limit: videoCount,
                    force: forceRefresh // Add force parameter to bypass cache
                });
                
                if (response.success) {
                    videos.push(...response.data);
                }
            }

            // Filter out watched videos
            const unwatchedVideos = videos.filter(video => !this.watchedVideos.has(video.videoId));
            
            // Sort by published date (newest first)
            unwatchedVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

            this.allVideos = unwatchedVideos;
            this.renderRecommendations(unwatchedVideos);
            const successMessage = forceRefresh ? 
                `Refreshed ${unwatchedVideos.length} fresh videos from API` : 
                `Loaded ${unwatchedVideos.length} unwatched videos`;
            this.showStatus(successMessage, 'success');
            this.updateVideoCountDisplay();

        } catch (error) {
            console.error('Error loading recommendations:', error);
            this.showStatus('Failed to load recommendations', 'error');
            document.getElementById('recommendationsContent').innerHTML = 
                '<div class="empty-state">Failed to load videos. Try refreshing.</div>';
        } finally {
            this.setLoading('recommendationsContent', false);
        }
    }

    async refreshVideos() {
        if (!this.isAuthenticated || this.enabledChannels.size === 0) {
            this.showStatus('No channels enabled for refresh', 'warning');
            return;
        }

        try {
            this.setLoading('recommendationsContent', true, 'Refreshing videos...');
            this.showStatus('Refreshing videos from API...', 'info');
            
            // Clear current videos and reload fresh content from API with force parameter
            this.allVideos = [];
            this.clearSelection();
            
            // await this.loadRecommendations(true); // Force refresh from API
            await this.loadRecommendations();
            
        } catch (error) {
            console.error('Error refreshing videos:', error);
            this.showStatus('Failed to refresh videos', 'error');
        }
    }

    shuffleVideos() {
        if (this.allVideos.length === 0) {
            this.showStatus('No videos to shuffle', 'warning');
            return;
        }

        // Fisher-Yates shuffle algorithm
        const shuffled = [...this.allVideos];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        this.renderRecommendations(shuffled);
        this.showStatus('Videos shuffled!', 'success');
    }

    async createAutoPlaylist() {
        try {
            this.setLoading('recommendationsContent', true, 'Creating playlist...');
            
            // Determine which videos to add - prioritize selected videos
            let videosToAdd = [];
            if (this.selectedVideos.size > 0) {
                // Use selected videos
                videosToAdd = this.allVideos.filter(video => this.selectedVideos.has(video.videoId));
                this.showStatus(`Creating playlist with ${videosToAdd.length} selected videos...`, 'info');
            } else {
                // Use all current videos
                videosToAdd = this.allVideos;
                this.showStatus(`Creating playlist with all ${videosToAdd.length} videos...`, 'info');
            }

            if (videosToAdd.length === 0) {
                this.showStatus('No videos to add to playlist', 'warning');
                return;
            }

            const now = new Date();
            const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
            
            // Check if playlist with this date already exists
            let playlistName = `MDW Tube ${dateStr}`;
            let counter = 1;
            
            while (this.playlists.some(p => p.title === playlistName)) {
                counter++;
                playlistName = `MDW Tube ${dateStr} (${counter})`;
            }
            
            // Create the playlist
            const createResponse = await this.sendMessage({
                action: 'createPlaylist',
                title: playlistName,
                description: `Auto-generated playlist from MDW Tube on ${new Date().toLocaleDateString()}`
            });

            if (!createResponse.success) {
                throw new Error(createResponse.error || 'Failed to create playlist');
            }

            const playlistId = createResponse.data.id;
            
            // Add videos to playlist
            let addedCount = 0;
            for (const video of videosToAdd) {
                try {
                    await this.sendMessage({
                        action: 'addVideoToPlaylist',
                        playlistId: playlistId,
                        videoId: video.videoId,
                        position: addedCount
                    });
                    addedCount++;
                } catch (error) {
                    console.warn(`Failed to add video ${video.videoId}:`, error);
                }
            }

            this.showStatus(`Auto playlist "${playlistName}" created with ${addedCount} videos!`, 'success');
            this.clearSelection();
            await this.loadPlaylists();
            
            // Switch to playlists tab
            this.switchTab('playlists');

        } catch (error) {
            console.error('Error creating auto playlist:', error);
            this.showStatus('Failed to create auto playlist', 'error');
        } finally {
            this.setLoading('recommendationsContent', false);
        }
    }

    async refreshChannels() {
        if (!this.isAuthenticated) return;
        
        try {
            const btn = document.getElementById('refreshChannelsBtn');
            btn.disabled = true;
            this.setLoading('channelsContent', true, 'Refreshing channels data...');
            this.showStatus('Refreshing channels data from API...', 'info');

            // Call API to get fresh channels data
            const response = await this.sendMessage({ action: 'getSubscriptions' });
            if (response.success) {
                this.subscriptions = response.data;
                this.renderSubscriptions();
                this.showStatus(`Refreshed ${this.subscriptions.length} channels from API`, 'success');
            } else {
                throw new Error(response.error || 'Failed to refresh channels');
            }
        } catch (error) {
            console.error('Error refreshing channels:', error);
            this.showStatus('Failed to refresh channels', 'error');
        } finally {
            const btn = document.getElementById('refreshChannelsBtn');
            if (btn) btn.disabled = false;
            this.setLoading('channelsContent', false);
        }
    }

    async refreshPlaylists() {
        if (!this.isAuthenticated) return;
        
        try {
            const btn = document.getElementById('refreshPlaylistsBtn');
            btn.disabled = true;
            this.setLoading('playlistsContent', true, 'Refreshing playlists...');
            this.showStatus('Refreshing playlists from API...', 'info');

            // Call API to get fresh playlists data
            const response = await this.sendMessage({ action: 'getPlaylists' });
            if (response.success) {
                this.playlists = response.data;
                this.renderPlaylists();
                this.showStatus(`Refreshed ${this.playlists.length} playlists from API`, 'success');
            } else {
                throw new Error(response.error || 'Failed to refresh playlists');
            }
        } catch (error) {
            console.error('Error refreshing playlists:', error);
            this.showStatus('Failed to refresh playlists', 'error');
        } finally {
            const btn = document.getElementById('refreshPlaylistsBtn');
            if (btn) btn.disabled = false;
            this.setLoading('playlistsContent', false);
        }
    }

    toggleVideoSelection(videoId) {
        if (this.selectedVideos.has(videoId)) {
            this.selectedVideos.delete(videoId);
        } else {
            this.selectedVideos.add(videoId);
        }
        this.updateMultiSelectControls();
        this.updateVideoSelectionUI();
    }

    clearSelection() {
        this.selectedVideos.clear();
        this.updateMultiSelectControls();
        this.updateVideoSelectionUI();
    }

    updateMultiSelectControls() {
        const controls = document.getElementById('multiSelectControls');
        const countElement = document.getElementById('selectedCount');
        
        if (this.selectedVideos.size > 0) {
            controls.classList.add('active');
            countElement.textContent = `${this.selectedVideos.size} selected`;
        } else {
            controls.classList.remove('active');
            countElement.textContent = '0 selected';
        }
    }

    updateVideoSelectionUI() {
        document.querySelectorAll('.video-item').forEach(item => {
            const videoId = item.dataset.videoId;
            const checkbox = item.querySelector('.video-checkbox');
            
            if (this.selectedVideos.has(videoId)) {
                item.classList.add('selected');
                if (checkbox) checkbox.checked = true;
            } else {
                item.classList.remove('selected');
                if (checkbox) checkbox.checked = false;
            }
        });
    }

    async addSelectedToPlaylist() {
        if (this.selectedVideos.size === 0) {
            this.showStatus('No videos selected', 'warning');
            return;
        }

        if (this.playlists.length === 0) {
            this.showStatus('No playlists available. Create one first.', 'warning');
            return;
        }

        const playlistNames = this.playlists.map((p, i) => `${i + 1}. ${p.title}`).join('\n');
        const selection = prompt(`Add ${this.selectedVideos.size} videos to playlist:\n${playlistNames}\n\nEnter number:`);
        
        if (selection) {
            const index = parseInt(selection) - 1;
            if (index >= 0 && index < this.playlists.length) {
                await this.addVideosToPlaylist(this.playlists[index].id, Array.from(this.selectedVideos));
            }
        }
    }

    async addVideosToPlaylist(playlistId, videoIds) {
        try {
            this.setLoading('recommendationsContent', true, 'Adding videos to playlist...');
            this.showStatus(`Adding ${videoIds.length} videos to playlist...`, 'info');
            
            for (const videoId of videoIds) {
                await this.sendMessage({
                    action: 'addVideoToPlaylist',
                    playlistId: playlistId,
                    videoId: videoId
                });
            }

            this.showStatus(`${videoIds.length} videos added to playlist!`, 'success');
            this.clearSelection();

        } catch (error) {
            console.error('Error adding videos to playlist:', error);
            this.showStatus('Failed to add videos to playlist', 'error');
        } finally {
            this.setLoading('recommendationsContent', false);
        }
    }

    async loadPlaylists() {
        if (!this.isAuthenticated) return;

        try {
            this.setLoading('playlistsContent', true, 'Loading playlists...');
            const response = await this.sendMessage({ action: 'getPlaylists' });
            if (response.success) {
                this.playlists = response.data;
                this.renderPlaylists();
            }
        } catch (error) {
            console.error('Error loading playlists:', error);
        } finally {
            this.setLoading('playlistsContent', false);
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
            this.setLoading('playlistsContent', true, 'Creating playlist...');
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
        } finally {
            this.setLoading('playlistsContent', false);
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
                    <div class="channel-meta">
                        <span class="channel-subscribers">${sub.subscriberCount || 'Unknown'} subscribers</span>
                    </div>
                </div>
                <div class="channel-controls">
                    <input type="number" class="video-count-input" 
                           value="${this.channelVideoCount.get(sub.channelId) || 5}" min="1" max="20" 
                           data-channel-id="${sub.channelId}" 
                           title="Videos per channel">
                    <label class="channel-toggle">
                        <input type="checkbox" ${this.enabledChannels.has(sub.channelId) ? 'checked' : ''} 
                               data-channel-id="${sub.channelId}">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
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

        // Add event listeners for video count inputs
        container.querySelectorAll('.video-count-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const channelId = e.target.dataset.channelId;
                const count = parseInt(e.target.value) || 5;
                this.channelVideoCount.set(channelId, count);
                this.saveChannelVideoCount();
                this.updateVideoCountDisplay();
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
            container.innerHTML = '<div class="empty-state">No unwatched videos available</div>';
            this.updateMultiSelectControls();
            return;
        }

        container.innerHTML = videos.map(video => `
            <div class="video-item" data-video-id="${video.videoId}">
                <input type="checkbox" class="video-checkbox" data-video-id="${video.videoId}">
                <div class="video-thumbnail-container">
                    <img class="video-thumbnail" src="${video.thumbnail}" alt="${this.escapeHtml(video.title)}">
                    <div class="video-duration">${this.formatDuration(video.duration)}</div>
                </div>
                <div class="video-content">
                    <div class="video-title">${this.escapeHtml(video.title)}</div>
                    <div class="video-stats">
                        <span>${this.formatViews(video.viewCount)} views</span>
                        <span>•</span>
                        <span>${this.formatDate(video.publishedAt)}</span>
                    </div>
                    <div class="video-actions">
                        <button class="video-action-btn watch" data-video-id="${video.videoId}" title="Watch video">
                            ▶️
                        </button>
                        <button class="video-action-btn playlist" data-video-id="${video.videoId}" title="Add to playlist">
                            ➕
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners for video selection
        container.querySelectorAll('.video-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const videoId = e.target.dataset.videoId;
                this.toggleVideoSelection(videoId);
            });
        });

        // Add event listeners for video actions
        container.querySelectorAll('.video-action-btn.watch').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const videoId = e.target.dataset.videoId;
                this.markVideoAsWatched(videoId);
                window.open(`https://youtube.com/watch?v=${videoId}`, '_blank');
            });
        });

        container.querySelectorAll('.video-action-btn.playlist').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const videoId = e.target.dataset.videoId;
                this.showPlaylistSelector(videoId);
            });
        });

        // Add click handlers for video items (excluding buttons and checkbox)
        container.querySelectorAll('.video-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Don't open modal if clicking on buttons or checkbox
                if (e.target.classList.contains('video-action-btn') || 
                    e.target.classList.contains('video-checkbox') ||
                    e.target.closest('.video-actions')) {
                    return;
                }
                
                // Open video modal on click
                const videoId = item.dataset.videoId;
                const video = videos.find(v => v.videoId === videoId);
                if (video) {
                    this.openVideoModal(video);
                }
            });
        });

        // Add error handling for video thumbnails
        container.querySelectorAll('.video-thumbnail').forEach(img => {
            img.addEventListener('error', () => {
                img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjY4IiB2aWV3Qm94PSIwIDAgMTIwIDY4IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjY4IiBmaWxsPSIjMzAzMDMwIi8+Cjx0ZXh0IHg9IjYwIiB5PSIzOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2FhYSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4=';
            });
        });

        this.updateVideoSelectionUI();
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
                    <div class="playlist-meta">
                        <span class="playlist-count">${playlist.itemCount} videos</span>
                    </div>
                </div>
                <div class="playlist-actions">
                    <button class="btn btn-primary view-playlist-btn external-link" data-playlist-id="${playlist.id}">
                        View
                    </button>
                    <button class="btn btn-delete delete-playlist-btn" data-playlist-id="${playlist.id}">
                        Delete
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

        container.querySelectorAll('.delete-playlist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const playlistId = e.target.dataset.playlistId;
                const playlist = this.playlists.find(p => p.id === playlistId);
                this.deletePlaylist(playlistId, playlist?.title);
            });
        });

        // Add error handling for playlist thumbnails
        container.querySelectorAll('.playlist-thumbnail').forEach(img => {
            img.addEventListener('error', () => {
                img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNDUiIHZpZXdCb3g9IjAgMCA4MCA0NSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjQ1IiBmaWxsPSIjMzAzMDMwIi8+Cjx0ZXh0IHg9IjQwIiB5PSIyNSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2FhYSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTAiPlBsYXlsaXN0PC90ZXh0Pgo8L3N2Zz4=';
            });
        });
    }

    async deletePlaylist(playlistId, playlistTitle) {
        const confirmation = confirm(`Are you sure you want to delete the playlist "${playlistTitle}"?\n\nThis action cannot be undone.`);
        
        if (!confirmation) return;

        try {
            this.setLoading('playlistsContent', true, 'Deleting playlist...');
            this.showStatus('Deleting playlist...', 'info');
            
            const response = await this.sendMessage({
                action: 'deletePlaylist',
                playlistId: playlistId
            });

            if (response.success) {
                this.showStatus('Playlist deleted successfully!', 'success');
                await this.loadPlaylists();
            } else {
                throw new Error(response.error || 'Failed to delete playlist');
            }

        } catch (error) {
            console.error('Error deleting playlist:', error);
            this.showStatus('Failed to delete playlist', 'error');
        } finally {
            this.setLoading('playlistsContent', false);
        }
    }

    async showPlaylistSelector(videoId) {
        if (this.playlists.length === 0) {
            this.showStatus('No playlists available. Create one first.', 'warning');
            return;
        }

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
            this.setLoading('recommendationsContent', true, 'Adding video to playlist...');
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
        } finally {
            this.setLoading('recommendationsContent', false);
        }
    }

    showLoggedInState() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        this.renderHeaderUser();
    }

    showLoggedOutState() {
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('mainContent').style.display = 'none';
        this.renderHeaderGuest();
    }

    renderHeaderUser() {
        const headerRight = document.getElementById('headerRight');
        const username = this.userInfo?.title || 'User';
        const avatarLetter = username.charAt(0).toUpperCase();
        
        headerRight.innerHTML = `
            <div class="user-info">
                <div class="user-avatar">${avatarLetter}</div>
                <span class="username">${this.escapeHtml(username)}</span>
            </div>
            <button class="sign-out-btn" id="signOutBtn">Sign Out</button>
        `;

        // Add event listener for sign out
        document.getElementById('signOutBtn').addEventListener('click', () => this.logout());
    }

    renderHeaderGuest() {
        const headerRight = document.getElementById('headerRight');
        headerRight.innerHTML = '';
    }

    clearData() {
        this.subscriptions = [];
        this.playlists = [];
        this.enabledChannels.clear();
        this.channelVideoCount.clear();
        this.selectedVideos.clear();
        this.allVideos = [];
        
        // Clear UI
        ['recommendationsContent', 'playlistsContent', 'channelsContent'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.innerHTML = '';
        });
        
        this.updateMultiSelectControls();
        this.updateVideoCountDisplay();
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
            const date = new Date(dateString);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
            if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
            return `${Math.floor(diffDays / 365)} years ago`;
        } catch {
            return 'Unknown date';
        }
    }

    formatDuration(duration) {
        if (!duration) return '';
        
        // Convert ISO 8601 duration to readable format
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return '';
        
        const hours = parseInt(match[1]) || 0;
        const minutes = parseInt(match[2]) || 0;
        const seconds = parseInt(match[3]) || 0;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    formatViews(viewCount) {
        if (!viewCount) return '0';
        
        const num = parseInt(viewCount);
        if (num >= 1000000) {
            return Math.floor(num / 1000000) + 'M';
        } else if (num >= 1000) {
            return Math.floor(num / 1000) + 'K';
        }
        return num.toString();
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MDWTubePopup();
}); 