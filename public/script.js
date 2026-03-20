// ==========================================
// TeamSync - WebRTC Peer-to-Peer Client
// Advanced Multi-Party Team Communication
// ==========================================

class TeamSyncClient {
    constructor() {
        this.socket = null;
        this.localStream = null;
        this.peers = new Map(); // Maps userId -> { connection, stream, video }
        this.peerNames = new Map(); // Maps userId -> userName
        this.sessionId = null;
        this.userId = null;
        this.userName = null;
        this.recognition = null;
        this.videoEnabled = true;
        this.audioEnabled = true;
        this.audioMuted = false; // Track if user intentionally muted
        this.isScreenSharing = false;
        this.originalStream = null;
        this.screenStream = null;
        this.transcripts = [];
        this.currentSpeaker = null;

        // ICE Servers configuration
        this.iceServers = [
            { urls: ['stun:stun.l.google.com:19302'] },
            { urls: ['stun:stun1.l.google.com:19302'] }
        ];

        this.initializeElements();
        this.setupEventListeners();
        this.initializeSpeechRecognition();
        this.checkUrlParams();
    }

    // ==========================================
    // Initialization
    // ==========================================

    initializeElements() {
        this.welcomeScreen = document.getElementById('welcome-screen');
        this.commScreen = document.getElementById('communication-screen');
        this.createSessionBtn = document.getElementById('create-session-btn');
        this.joinSessionBtn = document.getElementById('join-session-btn');

        this.sessionModal = document.getElementById('session-modal');
        this.sessionIdInput = document.getElementById('session-id-input');
        this.userNameInput = document.getElementById('user-name-input');
        this.sessionConfirmBtn = document.getElementById('session-confirm-btn');
        this.modalClose = document.querySelector('.modal-close');
        this.modalStatus = document.getElementById('modal-status');

        this.localVideo = document.getElementById('local-video');
        this.videoGrid = document.getElementById('video-grid');
        this.toggleVideoBtn = document.getElementById('toggle-video-btn');
        this.toggleAudioBtn = document.getElementById('toggle-audio-btn');
        this.screenShareBtn = document.getElementById('screen-share-btn');
        this.shareLinkBtn = document.getElementById('share-link-btn');
        this.leaveSessionBtn = document.getElementById('leave-session-btn');

        this.transcriptContent = document.getElementById('transcript-content');
        this.clearTranscriptBtn = document.getElementById('clear-transcript-btn');
        this.exportJsonBtn = document.getElementById('export-json-btn');
        this.exportPdfBtn = document.getElementById('export-pdf-btn');
        this.currentSpeakerSpan = document.getElementById('current-speaker');

        this.sessionIdDisplay = document.getElementById('session-id-display');
        this.participantCount = document.getElementById('participant-count');
        this.copyToast = document.getElementById('copy-toast');
    }

    setupEventListeners() {
        this.createSessionBtn.addEventListener('click', () => this.openSessionModal('create'));
        this.joinSessionBtn.addEventListener('click', () => this.openSessionModal('join'));
        this.sessionConfirmBtn.addEventListener('click', () => this.handleSessionConfirm());
        this.sessionIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSessionConfirm();
        });
        this.modalClose.addEventListener('click', () => this.closeSessionModal());

        this.toggleVideoBtn.addEventListener('click', () => this.toggleVideo());
        this.toggleAudioBtn.addEventListener('click', () => this.toggleAudio());
        this.screenShareBtn.addEventListener('click', () => this.shareScreen());
        this.shareLinkBtn.addEventListener('click', () => this.shareLink());
        this.leaveSessionBtn.addEventListener('click', () => this.leaveSession());
        this.clearTranscriptBtn.addEventListener('click', () => this.clearTranscript());
        this.exportJsonBtn.addEventListener('click', () => this.exportToJSON());
        this.exportPdfBtn.addEventListener('click', () => this.exportToPDF());
    }

    // ==========================================
    // Socket.IO Connection & Signaling
    // ==========================================

    initializeSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('✅ Connected to signaling server');
            this.socket.emit('join-session', {
                sessionId: this.sessionId,
                userName: this.userName
            });
        });

        // Receive list of existing participants
        this.socket.on('get-participants', (data) => {
            console.log('📞 Existing participants:', data.participants);
            this.userId = data.userId;
            data.participants.forEach(participant => {
                if (participant.id !== this.userId) {
                    this.peerNames.set(participant.id, participant.name);
                    this.initiateConnection(participant.id);
                }
            });
        });

        // New participant joined
        this.socket.on('participant-joined', (data) => {
            console.log(`👋 ${data.userName} joined`);
            this.peerNames.set(data.userId, data.userName);
            this.updateParticipantCount(data.totalParticipants);
            this.initiateConnection(data.userId);
        });

        // Participant left
        this.socket.on('participant-left', (data) => {
            console.log(`👋 ${data.userName} left`);
            this.removePeer(data.userId);
            this.updateParticipantCount(data.totalParticipants);
        });

        // WebRTC Signaling
        this.socket.on('offer', async (data) => {
            console.log(`📮 Received offer from ${data.from}`);
            
            let peerConnection = null;
            if (this.peers.has(data.from)) {
                peerConnection = this.peers.get(data.from).connection;
            }
            
            // Create new peer connection if needed
            if (!peerConnection) {
                console.log(`🆕 Creating new peer connection for ${data.from}`);
                peerConnection = this.createPeerConnection(data.from);
            }
            
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                this.socket.emit('answer', {
                    to: data.from,
                    answer: peerConnection.localDescription
                });
                console.log(`✅ Answer sent to ${data.from}`);
            } catch (error) {
                console.error('Error handling offer:', error);
            }
        });

        this.socket.on('answer', async (data) => {
            console.log(`📬 Received answer from ${data.from}`);
            if (this.peers.has(data.from)) {
                const peerConnection = this.peers.get(data.from).connection;
                if (peerConnection) {
                    try {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                        console.log(`✅ Answer processed for ${data.from}`);
                    } catch (error) {
                        console.error('Error setting remote description:', error);
                    }
                }
            }
        });

        // ICE Candidate
        this.socket.on('ice-candidate', async (data) => {
            if (this.peers.has(data.from)) {
                const peerInfo = this.peers.get(data.from);
                // Only add ICE candidate if we have a connection
                if (peerInfo.connection && data.candidate) {
                    try {
                        await peerInfo.connection.addIceCandidate(new RTCIceCandidate(data.candidate));
                    } catch (error) {
                        console.error('Error adding ICE candidate:', error);
                    }
                }
            }
        });

        // Transcript updates from other participants
        this.socket.on('transcript-update', (data) => {
            // Only add if it's from another speaker (not yourself)
            if (data.speaker !== this.userName) {
                this.addTranscript(data.speaker, data.text);
            }
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from signaling server');
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.showStatus('Connection error: ' + error);
        });
    }

    openSessionModal(mode) {
        const titleEl = document.getElementById('modal-title');
        const descEl = document.getElementById('modal-description');
        const confirmBtn = this.sessionConfirmBtn;

        if (mode === 'create') {
            titleEl.textContent = 'Create New Session';
            descEl.textContent = 'Enter your name to create a session:';
            this.sessionIdInput.style.display = 'none';
            confirmBtn.textContent = 'Create Session';
            this.sessionIdInput.value = '';
        } else {
            titleEl.textContent = 'Join Session';
            descEl.textContent = 'Enter the session ID and your name:';
            this.sessionIdInput.style.display = 'block';
            confirmBtn.textContent = 'Join Session';
        }

        this.userNameInput.value = '';
        this.modalStatus.textContent = '';
        this.sessionModal.dataset.mode = mode;
        this.sessionModal.classList.add('active');
        this.userNameInput.focus();
    }

    closeSessionModal() {
        this.sessionModal.classList.remove('active');
    }

    handleSessionConfirm() {
        const mode = this.sessionModal.dataset.mode;
        const userName = this.userNameInput.value.trim();

        if (!userName) {
            this.showStatus('Please enter your name');
            return;
        }

        if (mode === 'create') {
            this.createSession(userName);
        } else {
            const sessionId = this.sessionIdInput.value.trim();
            if (!sessionId) {
                this.showStatus('Please enter session ID');
                return;
            }
            this.joinSession(sessionId, userName);
        }
    }

    showStatus(message) {
        this.modalStatus.textContent = message;
    }

    // ==========================================
    // Session Management
    // ==========================================

    async createSession(userName) {
        try {
            this.showStatus('Creating session...');
            const response = await fetch('/api/sessions', { method: 'POST' });
            const data = await response.json();

            if (data.success) {
                this.sessionId = data.sessionId;
                this.userName = userName;
                await this.requestMediaAccess();
                await this.startSession();
                this.closeSessionModal();
            } else {
                this.showStatus('Failed to create session');
            }
        } catch (error) {
            console.error('Create session error:', error);
            this.showStatus('Error creating session: ' + error.message);
        }
    }

    async joinSession(sessionId, userName) {
        try {
            this.showStatus('Joining session...');
            const response = await fetch(`/api/sessions/${sessionId}`);
            const data = await response.json();

            if (data.success) {
                this.sessionId = sessionId;
                this.userName = userName;
                await this.requestMediaAccess();
                await this.startSession();
                this.closeSessionModal();
            } else {
                this.showStatus('Session not found');
            }
        } catch (error) {
            console.error('Join session error:', error);
            this.showStatus('Error joining session: ' + error.message);
        }
    }

    async requestMediaAccess() {
        try {
            this.showStatus('Requesting camera and microphone access...');
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: { echoCancellation: true, noiseSuppression: true }
            });
            
            this.localVideo.srcObject = this.localStream;
            this.videoEnabled = true;
            this.audioEnabled = true;
            this.toggleVideoBtn.classList.toggle('active', true);
            this.toggleAudioBtn.classList.toggle('active', true);
            
            console.log('📹 Media access granted');
        } catch (error) {
            console.error('Media access error:', error);
            throw new Error('Cannot access camera/microphone: ' + error.message);
        }
    }

    async startSession() {
        try {
            // Update user display
            document.getElementById('local-name').textContent = this.userName;

            // Switch UI
            this.welcomeScreen.classList.remove('active');
            this.commScreen.classList.add('active');

            // Update session info
            this.sessionIdDisplay.textContent = `PIN: ${this.sessionId}`;
            this.updateParticipantCount(1);

            // Initialize socket and signaling
            this.initializeSocket();

            // Start transcription
            this.startTranscription();

        } catch (error) {
            console.error('Start session error:', error);
            alert('Error starting session: ' + error.message);
        }
    }

    leaveSession() {
        if (confirm('Leave session?')) {
            // Stop local stream
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
            }

            // Stop screen share stream if active
            if (this.screenStream) {
                this.screenStream.getTracks().forEach(track => track.stop());
            }

            // Close peer connections
            this.peers.forEach((peer) => {
                if (peer.connection) peer.connection.close();
            });
            this.peers.clear();

            // Clear video grid
            const videosToRemove = this.videoGrid.querySelectorAll('.video-container:not(.local-video)');
            videosToRemove.forEach(v => v.remove());

            // Stop socket
            if (this.socket) this.socket.disconnect();
            if (this.recognition) this.recognition.stop();

            // Reset UI
            this.commScreen.classList.remove('active');
            this.welcomeScreen.classList.add('active');
        }
    }

    // ==========================================
    // WebRTC Peer Connections
    // ==========================================

    createPeerConnection(peerId) {
        const peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });

        // Add local streams BEFORE creating offer/answer
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                console.log(`📤 Adding ${track.kind} track to peer ${peerId}`);
                peerConnection.addTrack(track, this.localStream);
            });
        } else {
            console.warn('⚠️  No local stream available when creating peer connection');
        }

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('ice-candidate', {
                    to: peerId,
                    candidate: event.candidate
                });
            }
        };

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log('🎬 Received remote track from', peerId, 'kind:', event.track.kind);
            // Check if this is a secondary stream (screen share)
            const isScreenShare = document.getElementById(`video-${peerId}`) !== null && event.track.kind === 'video';
            this.addRemoteVideo(peerId, event.streams[0], isScreenShare);
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log(`Connection state with ${peerId}:`, peerConnection.connectionState);
            if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
                console.error(`❌ Connection failed with ${peerId}`);
                this.removePeer(peerId);
            }
        };

        // Handle ICE connection state for debugging
        peerConnection.oniceconnectionstatechange = () => {
            console.log(`ICE connection state with ${peerId}:`, peerConnection.iceConnectionState);
        };

        // Store peer connection
        const peerInfo = this.peers.get(peerId) || {};
        this.peers.set(peerId, { 
            ...peerInfo,
            connection: peerConnection, 
            stream: null 
        });

        return peerConnection;
    }

    initiateConnection(peerId) {
        // CRITICAL: Use tiebreaker to prevent simultaneous offer collision (glare)
        // Only the peer with the lexically smaller ID sends the offer
        const shouldISendOffer = this.userId < peerId;
        
        if (!shouldISendOffer) {
            console.log(`⏳ Waiting for offer from ${peerId} (they have lower ID)`);
            return;
        }
        
        console.log(`📤 Sending offer to ${peerId} (I have lower ID)`);
        
        // Check if connection already exists
        if (this.peers.has(peerId)) {
            const existingPeer = this.peers.get(peerId);
            if (existingPeer.connection && existingPeer.connection.signalingState !== 'closed') {
                console.log(`✅ Peer connection to ${peerId} already exists`);
                return;
            }
        }

        const peerConnection = this.createPeerConnection(peerId);
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => {
                this.socket.emit('offer', {
                    to: peerId,
                    offer: peerConnection.localDescription
                });
                console.log(`✅ Offer sent to ${peerId}`);
            })
            .catch(error => console.error('Offer error:', error));
    }

    addRemoteVideo(peerId, stream, isScreenShare = false) {
        const peerInfo = this.peers.get(peerId);
        if (peerInfo) {
            if (!isScreenShare) {
                // Primary camera stream
                peerInfo.stream = stream;

                // Check if video element already exists
                if (document.getElementById(`video-${peerId}`)) return;

                const container = document.createElement('div');
                container.className = 'video-container';
                container.id = `peer-${peerId}`;

                const video = document.createElement('video');
                video.id = `video-${peerId}`;
                video.autoplay = true;
                video.playsinline = true;
                video.srcObject = stream;

                const label = document.createElement('div');
                label.className = 'video-label';
                label.textContent = 'Peer';

                const nameLabel = document.createElement('div');
                nameLabel.className = 'peer-name';
                const peerName = this.peerNames.get(peerId) || 'Unknown User';
                nameLabel.textContent = peerName;

                const micIndicator = document.createElement('div');
                micIndicator.className = 'mic-indicator';
                micIndicator.innerHTML = '<div class="mic-pulse"></div>';

                container.appendChild(video);
                container.appendChild(label);
                container.appendChild(nameLabel);
                container.appendChild(micIndicator);
                this.videoGrid.appendChild(container);

                console.log('✅ Added remote video for', peerId);

            } else {
                // Screen share stream (secondary)
                peerInfo.screenShareStream = stream;

                // Check if screen share element already exists
                if (document.getElementById(`screen-${peerId}`)) return;

                const container = document.createElement('div');
                container.className = 'video-container screen-share-remote';
                container.id = `screen-${peerId}`;

                const video = document.createElement('video');
                video.id = `screen-video-${peerId}`;
                video.autoplay = true;
                video.playsinline = true;
                video.srcObject = stream;

                const label = document.createElement('div');
                label.className = 'video-label';
                label.textContent = 'Screen';

                const nameLabel = document.createElement('div');
                nameLabel.className = 'peer-name';
                
                // Get peer name from existing peer video label if available
                const existingPeerNameEl = document.querySelector(`#peer-${peerId} .peer-name`);
                const peerName = existingPeerNameEl ? existingPeerNameEl.textContent : 'Peer';
                nameLabel.textContent = peerName + "'s Screenshare";

                container.appendChild(video);
                container.appendChild(label);
                container.appendChild(nameLabel);
                this.videoGrid.appendChild(container);

                console.log('✅ Added screen share video for', peerId);
            }
        }
    }

    removePeer(peerId) {
        const peerInfo = this.peers.get(peerId);
        if (peerInfo && peerInfo.connection) {
            peerInfo.connection.close();
        }
        this.peers.delete(peerId);
        this.peerNames.delete(peerId);

        const videoElement = document.getElementById(`peer-${peerId}`);
        if (videoElement) videoElement.remove();

        // Also remove screen share video if it exists
        const screenElement = document.getElementById(`screen-${peerId}`);
        if (screenElement) screenElement.remove();

        console.log('🗑️  Removed peer', peerId);
    }

    // ==========================================
    // Media Controls
    // ==========================================

    async toggleVideo() {
        if (!this.localStream) return;
        
        // Toggle existing stream
        this.videoEnabled = !this.videoEnabled;
        this.localStream.getVideoTracks().forEach(track => {
            track.enabled = this.videoEnabled;
        });
        this.toggleVideoBtn.classList.toggle('active', this.videoEnabled);
        console.log('📹 Camera toggled:', this.videoEnabled ? 'on' : 'off');
    }

    toggleAudio() {
        if (!this.localStream) return;
        this.audioEnabled = !this.audioEnabled;
        this.localStream.getAudioTracks().forEach(track => {
            track.enabled = this.audioEnabled;
        });
        this.toggleAudioBtn.classList.toggle('active', this.audioEnabled);

        // Stop or resume speech recognition based on audio state
        if (!this.audioEnabled) {
            // Mute: stop transcription
            if (this.recognition) {
                this.recognition.stop();
                console.log('🔇 Speech recognition paused (mic muted)');
            }
        } else {
            // Unmute: resume transcription
            if (this.recognition) {
                try {
                    this.recognition.start();
                    console.log('🎤 Speech recognition resumed (mic unmuted)');
                } catch (e) {
                    console.log('Recognition already active');
                }
            }
        }
    }

    async shareScreen() {
        if (!this.localStream) {
            alert('No active session');
            return;
        }

        if (this.isScreenSharing) {
            // Stop screen share
            await this.stopScreenShare();
        } else {
            // Start screen share
            await this.startScreenShare();
        }
    }

    async startScreenShare() {
        try {
            // Request screen share
            this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always' },
                audio: false
            });

            // Get the video track
            const screenTrack = this.screenStream.getVideoTracks()[0];

            // Create a new stream containing only the screen
            const screenOnlyStream = new MediaStream([screenTrack]);

            // Add screen stream as secondary stream to all peer connections
            for (const [peerId, peerInfo] of this.peers) {
                peerInfo.connection.addTrack(screenTrack, screenOnlyStream);
            }

            // Create a local screen share display element
            const screenContainer = document.createElement('div');
            screenContainer.className = 'video-container screen-share-local';
            screenContainer.id = 'local-screen-share';

            const screenVideo = document.createElement('video');
            screenVideo.id = 'local-screen-video';
            screenVideo.autoplay = true;
            screenVideo.playsinline = true;
            screenVideo.srcObject = this.screenStream;

            const label = document.createElement('div');
            label.className = 'video-label';
            label.textContent = 'Screen';

            const nameLabel = document.createElement('div');
            nameLabel.className = 'peer-name';
            nameLabel.textContent = this.userName + "'s Screenshare";

            screenContainer.appendChild(screenVideo);
            screenContainer.appendChild(label);
            screenContainer.appendChild(nameLabel);

            // Insert screen share container after local video
            const localVideoContainer = document.querySelector('.local-video');
            localVideoContainer.parentNode.insertBefore(screenContainer, localVideoContainer.nextSibling);

            // Handle when user stops screen share from browser UI
            screenTrack.onended = async () => {
                await this.stopScreenShare();
            };

            this.isScreenSharing = true;
            this.screenShareBtn.classList.add('active');
            console.log('📺 Screen sharing started');

        } catch (error) {
            if (error.name !== 'NotAllowedError') {
                console.error('Screen share error:', error);
                alert('Could not share screen: ' + error.message);
            }
        }
    }

    async stopScreenShare() {
        try {
            // Stop screen stream tracks
            if (this.screenStream) {
                this.screenStream.getTracks().forEach(track => track.stop());
            }

            // Remove screen track from all peer connections
            for (const [peerId, peerInfo] of this.peers) {
                const senders = peerInfo.connection.getSenders();
                for (const sender of senders) {
                    if (sender.track && sender.track.kind === 'video' && sender.track !== this.localStream.getVideoTracks()[0]) {
                        try {
                            await peerInfo.connection.removeTrack(sender);
                        } catch (e) {
                            console.log('Error removing screen track:', e);
                        }
                    }
                }
            }

            // Remove local screen share display element
            const screenShareContainer = document.getElementById('local-screen-share');
            if (screenShareContainer) {
                screenShareContainer.remove();
            }

            this.isScreenSharing = false;
            this.screenShareBtn.classList.remove('active');
            console.log('📺 Screen sharing stopped');

        } catch (error) {
            console.error('Error stopping screen share:', error);
        }
    }

    // ==========================================
    // Link Sharing
    // ==========================================

    shareLink() {
        const inviteLink = `${window.location.origin}?session=${this.sessionId}`;
        navigator.clipboard.writeText(inviteLink).then(() => {
            this.showToast('Invite link copied!');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = inviteLink;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showToast('Invite link copied!');
        });
    }

    showToast(message) {
        this.copyToast.textContent = message;
        this.copyToast.classList.add('show');
        setTimeout(() => {
            this.copyToast.classList.remove('show');
        }, 3000);
    }

    // ==========================================
    // Speech Recognition & Transcription
    // ==========================================

    initializeSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('Speech Recognition not supported');
            this.transcriptContent.innerHTML = '<div class="transcript-info">⚠️ Speech Recognition not supported. Please use Chrome, Edge, or Safari.</div>';
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.language = 'en-US';

        let interimTranscript = '';

        this.recognition.onstart = () => {
            console.log('🎤 Speech recognition started');
        };

        this.recognition.onresult = (event) => {
            interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    this.addTranscript(this.userName, transcript);
                    this.socket?.emit('add-transcript', { text: transcript });
                } else {
                    interimTranscript += transcript;
                }
            }

            if (interimTranscript) {
                this.updateCurrentSpeaking(this.userName, interimTranscript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
        };

        this.recognition.onend = () => {
            // Only auto-restart if still in session and audio is not muted
            if (this.sessionId && this.audioEnabled) {
                try {
                    this.recognition.start();
                } catch (e) {
                    console.log('Recognition already started');
                }
            }
        };
    }

    startTranscription() {
        if (this.recognition) {
            try {
                this.recognition.start();
            } catch (e) {
                console.log('Recognition already active');
            }
        }
    }

    addTranscript(speaker, text) {
        if (!text.trim()) return;

        // Check if this transcript already exists (avoid duplicates)
        const lastTranscript = this.transcripts[this.transcripts.length - 1];
        if (lastTranscript && 
            lastTranscript.speaker === speaker && 
            lastTranscript.text === text.trim()) {
            return; // Skip duplicate
        }

        this.transcripts.push({
            speaker,
            text: text.trim(),
            timestamp: new Date().toLocaleTimeString()
        });

        if (this.transcripts.length > 15) {
            this.transcripts.shift();
        }

        this.updateTranscriptDisplay();
    }

    updateTranscriptDisplay() {
        this.transcriptContent.innerHTML = this.transcripts.map(item => `
            <div class="transcript-item">
                <div class="transcript-speaker">${escapeHtml(item.speaker)} <span style="color: var(--text-secondary); font-weight: normal;">${item.timestamp}</span></div>
                <div class="transcript-text">${escapeHtml(item.text)}</div>
            </div>
        `).join('');

        this.transcriptContent.scrollTop = this.transcriptContent.scrollHeight;
    }

    updateCurrentSpeaking(speaker, text = '') {
        this.currentSpeaker = speaker;
        this.currentSpeakerSpan.textContent = speaker;
    }

    clearTranscript() {
        this.transcripts = [];
        this.transcriptContent.innerHTML = '<div class="transcript-info">Transcript cleared</div>';
    }

    exportToJSON() {
        if (this.transcripts.length === 0) {
            alert('No transcript to export');
            return;
        }

        const exportData = {
            sessionId: this.sessionId,
            userName: this.userName,
            exportDate: new Date().toISOString(),
            transcripts: this.transcripts
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `transcript_${this.sessionId}_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.showToast('Transcript exported as JSON');
    }

    exportToPDF() {
        if (this.transcripts.length === 0) {
            alert('No transcript to export');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Header
        doc.setFontSize(16);
        doc.text('TeamSync - Session Transcript', 14, 15);

        // Session info
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Session ID: ${this.sessionId}`, 14, 25);
        doc.text(`Participant: ${this.userName}`, 14, 31);
        doc.text(`Exported: ${new Date().toLocaleString()}`, 14, 37);

        // Transcripts
        doc.setTextColor(0);
        let yPos = 45;
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 14;
        const maxWidth = 182;

        this.transcripts.forEach((item) => {
            const speakerText = `${item.speaker} [${item.timestamp}]:`;
            
            // Check if we need a new page
            if (yPos > pageHeight - 20) {
                doc.addPage();
                yPos = 15;
            }

            // Speaker name (bold-ish)
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text(speakerText, margin, yPos);
            yPos += 6;

            // Transcript text (wrapped)
            doc.setFont(undefined, 'normal');
            doc.setFontSize(9);
            const lines = doc.splitTextToSize(item.text, maxWidth);
            lines.forEach((line) => {
                if (yPos > pageHeight - 10) {
                    doc.addPage();
                    yPos = 15;
                }
                doc.text(line, margin + 5, yPos);
                yPos += 5;
            });

            yPos += 3; // Space between entries
        });

        // Save PDF
        doc.save(`transcript_${this.sessionId}_${Date.now()}.pdf`);
        this.showToast('Transcript exported as PDF');
    }

    // ==========================================
    // Utilities
    // ==========================================

    updateParticipantCount(count) {
        this.participantCount.textContent = `Participants: ${count}`;
    }

    checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const sessionParam = params.get('session');
        if (sessionParam) {
            this.sessionIdInput.value = sessionParam;
            setTimeout(() => this.openSessionModal('join'), 500);
        }
    }
}

// ==========================================
// Utility Functions
// ==========================================

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// ==========================================
// Initialize on DOMContentLoaded
// ==========================================

let client;
document.addEventListener('DOMContentLoaded', () => {
    client = new TeamSyncClient();
    console.log('%c🎤 TeamSync Client Ready', 'font-size: 14px; color: #00a8ff; font-weight: bold;');
});
