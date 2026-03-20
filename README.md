# TeamSync - Advanced Full-Stack Team Communication Platform

A production-ready, full-stack Node.js application featuring real-time peer-to-peer video/audio conferencing with AI-powered speech-to-text transcription and WebRTC signaling.

## 🎯 Features

### Core Communication
- **Multi-Party Video/Audio** - WebRTC peer-to-peer connections for unlimited participants
- **Signaling Server** - Node.js + Socket.IO for coordinating peer connections
- **Session Management** - Create sessions or join with session IDs
- **Link Sharing** - Generate shareable invite links for easy onboarding
- **ICE Candidate Exchange** - Automatic NAT traversal using STUN servers

### AI & Transcription
- **Real-Time Speech-to-Text** - Web Speech API for automatic conversation transcription
- **Live Transcription Display** - See transcripts appear in real-time
- **Speaker Identification** - Know who said what with speaker labels
- **Persistent Transcripts** - Server-side transcript storage
- **Multi-Language Support** - 200+ languages available

### Advanced Features
- **Screen Sharing** - Share your screen with all participants in real-time
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Dark Blue Cyberpunk Theme** - Modern professional aesthetics
- **Media Controls** - Independent video/audio toggle
- **Session Persistence** - Sessions stored on server
- **Health Monitoring** - Server health checks and diagnostics
- **Automatic Cleanup** - Inactive sessions auto-deleted after 30 minutes

## 🚀 Quick Start

### Prerequisites
- **Node.js** 14+ (https://nodejs.org)
- **npm** 6+ (comes with Node.js)
- **Modern browser**: Chrome, Firefox, Safari, or Edge (all recent versions)

### Installation

1. **Navigate to project**
   ```bash
   cd c:\Users\jamie\Desktop\LLTheGreat
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

   You should see:
   ```
   ╔════════════════════════════════════════╗
   ║   🎤 TeamSync Signaling Server 🎤      ║
   ╚════════════════════════════════════════╝

   📡 Server running at: http://localhost:3000
   ```

4. **Open in browser**
   - Visit `http://localhost:3000`
   - Allow camera/microphone access when prompted

### For Development (with auto-reload)

```bash
npm install -D nodemon
npm run dev
```

## 🎮 How to Use

### Creating a Session

1. Click **"Create Session"**
2. Enter your name
3. Click **"Create Session"**
4. Share the invite link with others
5. Start communicating!

### Joining a Session

1. Click **"Join Session"**
2. Paste the session ID or use URL with `?session=...`
3. Enter your name
4. Click **"Join Session"**

### Controls

| Control | Function |
|---------|----------|
| 📹 | Toggle camera on/off |
| 🎤 | Toggle microphone on/off |
| 🖥️ | Share your screen (toggle on/off) |
| 🔗 | Copy invite link to clipboard |
| 📞 | Leave the session |
| 📄 JSON | Export transcript as JSON file |
| 📋 PDF | Export transcript as PDF file |
| Clear | Clear transcript history |

### Screen Sharing

1. Click the **📺 Screen Share** button during a session
2. Select which screen/window you want to share
3. Click **Share** in the browser dialog
4. Your webcam feed **stays visible** and your screen appears as a separate video labeled "Your Name's Screenshare"
5. All participants see both your camera AND your screen simultaneously
6. Click the button again to stop sharing

**Example**: If Anthony is in a session, he'll initially see his own webcam feed labeled "You". When he clicks the screen share button, a second video container appears labeled "Anthony's Screenshare" showing his screen, while his original webcam video continues to show alongside it.

### Exporting Transcripts

Transcripts can be exported in two formats for record-keeping and sharing:

**JSON Export:**
- Click the **📄 JSON** button in the transcript panel
- Saves transcript as a JSON file containing speaker names, text, timestamps, session ID, and export date
- Useful for programmatic processing or importing into other tools

**PDF Export:**
- Click the **📋 PDF** button in the transcript panel
- Generates a formatted PDF document with session information and speaker attributions
- Includes proper page breaks and text wrapping
- Ideal for sharing, printing, or archiving

Both exports include the full conversation history shown in the live transcription panel.

## 🏗️ Project Structure

```
LLTheGreat/
├── server.js              # Main signaling server (Node.js)
├── package.json          # Dependencies and scripts
├── .env.example          # Environment configuration template
├── public/               # Frontend files
│   ├── index.html        # Main HTML interface
│   ├── styles.css        # Dark blue cyberpunk theme
│   └── script.js         # WebRTC client implementation
└── README.md             # This file
```

## 🌐 API Endpoints

### REST APIs

```
POST   /api/sessions              - Create new session
GET    /api/sessions/:id          - Get session info
GET    /api/sessions/:id/transcript - Get session transcript
GET    /api/health                - Health check
```

### WebSocket Events

**Client → Server:**
- `join-session` - Join a session
- `offer` - Send WebRTC offer
- `answer` - Send WebRTC answer
- `ice-candidate` - Send ICE candidate
- `add-transcript` - Add transcript entry
- `get-participants` - Request participant list

**Server → Client:**
- `get-participants` - Receive participant list
- `participant-joined` - New participant joined
- `participant-left` - Participant left
- `offer` - Receive WebRTC offer
- `answer` - Receive WebRTC answer
- `ice-candidate` - Receive ICE candidate
- `transcript-update` - Transcript broadcast
- `participants-list` - Participant list update

## 🔒 Security & Privacy

- **Local Processing**: Speech-to-text processed locally in your browser
- **No Cloud Storage**: Transcripts stored only on server by default
- **Peer-to-Peer**: Direct WebRTC connections between participants
- **End-to-End**: Data encrypted in transit
- **Session IDs**: Randomly generated, alphanumeric
- **Auto Cleanup**: Inactive sessions deleted after 30 minutes

### Best Practices
- Share session IDs only with intended participants
- Enable video/audio only when needed
- Clear sensitive transcripts after use
- Use HTTPS in production (required for WebRTC)

## 🛠️ Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
PORT=3000                          # Server port
HOST=0.0.0.0                       # Bind to all interfaces
NODE_ENV=development               # development or production

# Optional: TURN Server for production
TURN_URL=your-turn-server.com
TURN_USERNAME=username
TURN_PASSWORD=password
```

### Customization

#### Change Port
```bash
PORT=8080 npm start
```

#### Change Theme Colors
Edit `public/styles.css` (lines 1-11):
```css
:root {
    --primary-color: #00a8ff;      /* Cyan */
    --secondary-color: #0066cc;    /* Dark Blue */
    --accent-color: #00ffff;       /* Light Cyan */
    --dark-bg: #0d1b2a;            /* Very Dark Blue */
    /* ... rest of colors ... */
}
```

#### Adjust Speech-to-Text Language
Edit `public/script.js` (search for `recognition.language`):
```javascript
this.recognition.language = 'es-ES';  // Spanish
this.recognition.language = 'fr-FR';  // French
this.recognition.language = 'de-DE';  // German
```

## 📊 Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| WebRTC Video | ✅ | ✅ | ✅ | ✅ |
| WebRTC Audio | ✅ | ✅ | ✅ | ✅ |
| Speech-to-Text | ✅ | ✅ | ✅ | ✅ |
| Session Storage | ✅ | ✅ | ✅ | ✅ |

**Notes**: 
- All browsers require HTTPS in production
- HTTP works for localhost development
- Speech-to-Text works best in Chrome and Edge

## 🚢 Deployment

### Local Testing
```bash
npm start
# Visit http://localhost:3000
```

### Production Deployment

#### Using Heroku
```bash
npm install -g heroku-cli
heroku login
git init
git add .
git commit -m "Initial commit"
heroku create your-app-name
git push heroku main
```

#### Using Railway
```bash
npm install -g railway
railway login
railway link
railway up
```

#### Using DigitalOcean App Platform
```bash
# Create app.yaml with Node.js configuration
# Push code to DigitalOcean App Platform
# Follow DigitalOcean deployment guide
```

### Production Checklist
- [ ] Use HTTPS (required for WebRTC)
- [ ] Set `NODE_ENV=production`
- [ ] Configure TURN server (if needed)
- [ ] Set strong session ID generation
- [ ] Enable CORS settings
- [ ] Configure proper logging
- [ ] Set up monitoring
- [ ] Enable auto-scaling for multiple instances

## 🐛 Troubleshooting

### Server Won't Start
```
Error: Port 3000 already in use
→ Use different port: PORT=3001 npm start
```

### Camera/Microphone Not Working
1. Check browser permissions
2. Ensure no other app is using camera
3. Try different browser
4. Check system camera settings

### No Sound from Remote Participants
1. Check microphone is enabled
2. Unmute audio buttons
3. Check system volume
4. Verify other user has audio enabled

### Speech-to-Text Not Working
1. Ensure microphone is accessible
2. Check browser supports Web Speech API
3. Try speaking clearly
4. Refresh page if stuck
5. Check console for errors (F12)

### Video Freezes or Lags
- Close other applications
- Reduce number of participants
- Lower video resolution if available
- Check internet connection
- Move closer to WiFi router
- Restart browser

### WebRTC Connection Issues
- **Behind firewall**: TURN server needed (production)
- **Multiple NAT layers**: May need external TURN
- **IPv6 issues**: Use IPv4 or configure ICE servers

## 🚀 Advanced Usage

### API Examples

#### Create Session
```bash
curl -X POST http://localhost:3000/api/sessions
```

#### Get Session Info
```bash
curl http://localhost:3000/api/sessions/session-abc123xyz
```

#### Get Session Transcript
```bash
curl http://localhost:3000/api/sessions/session-abc123xyz/transcript
```

#### Health Check
```bash
curl http://localhost:3000/api/health
```

## 🎓 Technical Details

### WebRTC Flow
1. **Signaling**: Socket.IO exchanges SDP offers/answers
2. **ICE**: STUN servers help peers discover each other
3. **P2P Connection**: Direct peer-to-peer data/media
4. **Stream Exchange**: Audio/video tracks exchanged

### Speech Recognition
- Uses Web Speech API (Chrome, Firefox, Safari, Edge)
- Processes locally in browser (no external API calls)
- Supports 200+ languages
- Continuous mode for uninterrupted transcription

### Transcript Storage
- Stored in-memory on server
- Persists for session duration
- Retrievable via REST API
- Auto-deleted with session

## 📈 Scalability

### Current Limits
- **Participants per session**: Theoretically unlimited (hardware dependent)
- **Concurrent sessions**: Limited by server resources
- **Transcript size**: 15 items kept in memory (configurable)

### For Scaling Production
- Use load balancer (nginx, HAProxy)
- Implement Redis for session state
- Use WebRTC SFU (Selective Forwarding Unit) for 50+ users
- Implement database for persistent storage
- Use CDN for static assets
- Enable clustering with Node.js

## 🤝 Contributing

Feel free to fork, modify, and enhance! Key areas for contribution:
- Better video codec support
- Screen sharing
- Recording functionality
- User authentication
- Database integration
- Mobile app versions

## 📚 Resources

- [WebRTC Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Socket.IO Guide](https://socket.io/docs/)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Express.js Docs](https://expressjs.com/)
- [Node.js Docs](https://nodejs.org/docs/)

## 📄 License

MIT License - Free to use for personal and commercial projects

## 🎯 Future Roadmap

- [x] Screen sharing
- [ ] Session recording
- [ ] User authentication
- [ ] Database integration (MongoDB/PostgreSQL)
- [ ] Mobile iOS/Android apps
- [ ] Virtual backgrounds
- [ ] Meeting scheduling
- [ ] Breakout rooms
- [ ] Chat messaging
- [ ] Emoji reactions

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review browser console (F12)
3. Check server logs
4. Try different browser
5. Ensure all permissions granted

---

**TeamSync - Built for Modern Team Collaboration**

Full-Stack Edition | March 2026

**Ready to run locally and deploy to production!** 🚀
"# Groupa" 
