// ==========================================
// TeamSync - AI-Powered Team Communication
// ==========================================

class TeamSync {
    constructor() {
        this.sessionId = null;
        this.localStream = null;
        this.peers = new Map();
        this.recognition = null;
        this.isTranscribing = false;
        this.currentSpeaker = null;
        this.videoEnabled = true;
        this.audioEnabled = true;
        this.transcripts = [];

        this.initializeElements();
        this.setupEventListeners();
        this.initializeSpeechRecognition();
    }

    initializeElements() {
        // Welcome screen
        this.welcomeScreen = document.getElementById('welcome-screen');
        this.commScreen = document.getElementById('communication-screen');
        this.createSessionBtn = document.getElementById('create-session-btn');
        this.joinSessionBtn = document.getElementById('join-session-btn');

        // Join modal
        this.joinModal = document.getElementById('join-modal');
        this.sessionIdInput = document.getElementById('session-id-input');
        this.joinConfirmBtn = document.getElementById('join-confirm-btn');
        this.modalClose = document.querySelector('.modal-close');

        // Video and controls
        this.localVideo = document.getElementById('local-video');
        this.videoGrid = document.getElementById('video-grid');
        this.toggleVideoBtn = document.getElementById('toggle-video-btn');
        this.toggleAudioBtn = document.getElementById('toggle-audio-btn');
        this.shareLinkBtn = document.getElementById('share-link-btn');
        this.leaveSessionBtn = document.getElementById('leave-session-btn');

        // Transcription
        this.transcriptContent = document.getElementById('transcript-content');
        this.clearTranscriptBtn = document.getElementById('clear-transcript-btn');
        this.currentSpeakerSpan = document.getElementById('current-speaker');

        // Session info
        this.sessionIdDisplay = document.getElementById('session-id-display');
        this.participantCount = document.getElementById('participant-count');
        this.copyToast = document.getElementById('copy-toast');
    }

    setupEventListeners() {
        this.createSessionBtn.addEventListener('click', () => this.createSession());
        this.joinSessionBtn.addEventListener('click', () => this.openJoinModal());
        this.joinConfirmBtn.addEventListener('click', () => this.joinSession());
        this.sessionIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinSession();
        });
        this.modalClose.addEventListener('click', () => this.closeJoinModal());

        this.toggleVideoBtn.addEventListener('click', () => this.toggleVideo());
        this.toggleAudioBtn.addEventListener('click', () => this.toggleAudio());
        this.shareLinkBtn.addEventListener('click', () => this.shareLink());
        this.leaveSessionBtn.addEventListener('click', () => this.leaveSession());

        this.clearTranscriptBtn.addEventListener('click', () => this.clearTranscript());
    }

    // ==========================================
    // Session Management
    // ==========================================

    generateSessionId() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = 'teamsync-';
        for (let i = 0; i < 12; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async createSession() {
        try {
            this.sessionId = this.generateSessionId();
            await this.startSession();
        } catch (error) {
            console.error('Error creating session:', error);
            alert('Failed to create session. Check console for details.');
        }
    }

    joinSession() {
        const sessionId = this.sessionIdInput.value.trim();
        if (!sessionId) {
            alert('Please enter a session ID');
            return;
        }
        this.sessionId = sessionId;
        this.closeJoinModal();
        this.startSession();
    }

    async startSession() {
        try {
            // Request media access
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: { echoCancellation: true, noiseSuppression: true }
            });

            // Display local video
            this.localVideo.srcObject = this.localStream;

            // Switch to communication screen
            this.welcomeScreen.classList.remove('active');
            this.commScreen.classList.add('active');

            // Update session info
            this.sessionIdDisplay.textContent = `Session ID: ${this.sessionId}`;

            // Start speech recognition
            this.startTranscription();

            // Simulate peer connections (in production, use WebRTC signaling server)
            this.setupLocalPeerDisplay();

        } catch (error) {
            console.error('Error accessing media:', error);
            alert('Cannot access camera/microphone. Please check permissions.');
        }
    }

    leaveSession() {
        if (confirm('Are you sure you want to leave the session?')) {
            // Stop local stream
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
            }

            // Stop transcription
            if (this.recognition) {
                this.recognition.stop();
            }

            // Clear peers
            this.peers.forEach((peer) => {
                if (peer.connection) peer.connection.close();
            });
            this.peers.clear();

            // Reset UI
            this.videoGrid.innerHTML = '';

            // Return to welcome screen
            this.commScreen.classList.remove('active');
            this.welcomeScreen.classList.add('active');

            this.sessionId = null;
        }
    }

    // ==========================================
    // Media Controls
    // ==========================================

    toggleVideo() {
        if (!this.localStream) return;

        this.videoEnabled = !this.videoEnabled;
        this.localStream.getVideoTracks().forEach(track => {
            track.enabled = this.videoEnabled;
        });

        this.toggleVideoBtn.classList.toggle('active', this.videoEnabled);
    }

    toggleAudio() {
        if (!this.localStream) return;

        this.audioEnabled = !this.audioEnabled;
        this.localStream.getAudioTracks().forEach(track => {
            track.enabled = this.audioEnabled;
        });

        this.toggleAudioBtn.classList.toggle('active', this.audioEnabled);
    }

    // ==========================================
    // Link Sharing
    // ==========================================

    shareLink() {
        const inviteLink = `${window.location.origin}${window.location.pathname}?session=${this.sessionId}`;
        
        navigator.clipboard.writeText(inviteLink).then(() => {
            this.showToast('Invite link copied to clipboard!');
        }).catch(() => {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = inviteLink;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showToast('Invite link copied to clipboard!');
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
            console.warn('Speech Recognition API not supported in this browser');
            this.transcriptContent.innerHTML = '<div class="transcript-info">⚠️ Speech Recognition not supported in your browser. Please use Chrome, Edge, or Safari.</div>';
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.language = 'en-US';

        let interimTranscript = '';

        this.recognition.onstart = () => {
            this.isTranscribing = true;
        };

        this.recognition.onresult = (event) => {
            interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;

                if (event.results[i].isFinal) {
                    this.addTranscript('You', transcript, true);
                } else {
                    interimTranscript += transcript;
                }
            }

            // Display interim results
            if (interimTranscript) {
                this.updateCurrentSpeaking('You', interimTranscript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
        };

        this.recognition.onend = () => {
            this.isTranscribing = false;
            // Restart recognition
            if (this.sessionId) {
                try {
                    this.recognition.start();
                } catch (e) {
                    console.log('Recognition already started');
                }
            }
        };
    }

    startTranscription() {
        if (this.recognition && !this.isTranscribing) {
            try {
                this.recognition.start();
            } catch (e) {
                console.log('Recognition already active');
            }
        }
    }

    addTranscript(speaker, text, isFinal = false) {
        if (!text.trim()) return;

        this.transcripts.push({
            speaker,
            text: text.trim(),
            timestamp: new Date().toLocaleTimeString()
        });

        // Limit transcript display to last 15 items for performance
        if (this.transcripts.length > 15) {
            this.transcripts.shift();
        }

        this.updateTranscriptDisplay();
        this.currentSpeaker = speaker;
        this.updateCurrentSpeaking(speaker);
    }

    updateTranscriptDisplay() {
        this.transcriptContent.innerHTML = this.transcripts.map(item => `
            <div class="transcript-item">
                <div class="transcript-speaker">${escapeHtml(item.speaker)} <span style="color: var(--text-secondary); font-weight: normal;">${item.timestamp}</span></div>
                <div class="transcript-text">${escapeHtml(item.text)}</div>
            </div>
        `).join('');

        // Auto-scroll to bottom
        this.transcriptContent.scrollTop = this.transcriptContent.scrollHeight;
    }

    updateCurrentSpeaking(speaker, text = '') {
        this.currentSpeakerSpan.textContent = speaker;
    }

    clearTranscript() {
        this.transcripts = [];
        this.transcriptContent.innerHTML = '<div class="transcript-info">Transcript cleared</div>';
    }

    // ==========================================
    // Peer Display (Simulated)
    // ==========================================

    setupLocalPeerDisplay() {
        // Show local video in grid (already displayed)
        // In production, peers would be added as they join via WebRTC
    }

    // ==========================================
    // Modal Management
    // ==========================================

    openJoinModal() {
        this.joinModal.classList.add('active');
        this.sessionIdInput.focus();
    }

    closeJoinModal() {
        this.joinModal.classList.remove('active');
        this.sessionIdInput.value = '';
    }
}

// Utility Functions

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
// Initialization
// ==========================================

let teamSync;

document.addEventListener('DOMContentLoaded', () => {
    teamSync = new TeamSync();

    // Check if joining via URL parameter
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session');
    if (sessionParam) {
        teamSync.sessionIdInput.value = sessionParam;
        teamSync.openJoinModal();
    }
});

// Advanced Feature: Virtual Background (Chrome 90+)
// Note: This is commented out as it requires additional setup
/*
async function setupVirtualBackground() {
    if (!navigator.mediaDevices.getSupportedConstraints().backgroundBlur) {
        console.warn('Virtual background not supported');
        return;
    }

    const videoTrack = teamSync.localStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();

    // Apply background blur
    await videoTrack.applyConstraints({
        backgroundBlur: { blur: true }
    });
}
*/

// Advanced Feature: Screen Sharing
async function startScreenShare() {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: 'always' },
            audio: false
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = teamSync.peers.get(teamSync.localPeerId)?.connection
            .getSenders()
            .find(s => s.track && s.track.kind === 'video');

        if (sender) {
            await sender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
            // Switch back to camera
        };
    } catch (error) {
        console.error('Screen share error:', error);
    }
}

// Initialize particles/visual effects for background
function createBackgroundParticles() {
    // Optional: Add animated particles for visual appeal
    // This is a placeholder for future enhancement
}

console.log('%c🎤 TeamSync Ready', 'font-size: 16px; color: #00a8ff; font-weight: bold;');
console.log('Features: Video/Audio Streaming, Real-time Speech-to-Text, Session Sharing');
