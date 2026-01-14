# Arduino Compiler Service

This is a Docker-based Arduino compilation service that compiles Arduino sketches and returns HEX files for WebSerial upload.

## 🚀 One-Click Deploy Options

### Option 1: Deploy to Render.com (FREE - Recommended)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

1. Go to [Render.com](https://render.com) and create a free account
2. Click "New +" → "Web Service"
3. Select "Build and deploy from a Git repository" or use Docker
4. Configure:
   - **Name**: `arduino-compiler`
   - **Region**: Choose closest to you
   - **Instance Type**: Free
   - **Docker Command**: Leave default
5. Add the files from this folder to a GitHub repo, or use Docker directly
6. After deploy, copy the URL (e.g., `https://arduino-compiler.onrender.com`)
7. **Add to Lovable**: Go to Cloud → Secrets → Add `ARDUINO_COMPILER_URL` with your service URL

### Option 2: Deploy to Railway.app (FREE tier available)

1. Create account at [Railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub and create a repo with these files
4. Railway will auto-detect Dockerfile and deploy
5. Go to Settings → Generate Domain to get public URL
6. Copy URL and add as `ARDUINO_COMPILER_URL` secret in Lovable

### Option 3: Deploy to Google Cloud Run

```bash
# Install gcloud CLI, then:
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Deploy (from this directory)
gcloud run deploy arduino-compiler \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 120
```

### Option 4: Run Locally (for testing)

```bash
cd docs/arduino-compiler-service
docker build -t arduino-compiler .
docker run -p 3001:3001 arduino-compiler
# Then set ARDUINO_COMPILER_URL=http://localhost:3001
```

## 📋 After Deployment

1. Copy your deployed service URL
2. In Lovable, go to **Cloud → Secrets**
3. Add a new secret:
   - **Name**: `ARDUINO_COMPILER_URL`
   - **Value**: Your service URL (e.g., `https://arduino-compiler.onrender.com`)
4. Click Build in the Arduino IDE - it will now compile real HEX files!

## API Endpoints

### POST /compile

Compile Arduino code and return HEX file.

**Request:**
```json
{
  "code": "void setup() {...} void loop() {...}",
  "fqbn": "arduino:avr:uno"
}
```

**Response (success):**
```json
{
  "success": true,
  "hex": ":100000000C9434000C9446000C9446000C944600CE...",
  "output": "Sketch uses 924 bytes (2%) of program storage...",
  "size": {
    "flash": 924,
    "ram": 9
  }
}
```

### GET /health
Health check endpoint.

### GET /boards
List available boards and their FQBNs.

## Supported Boards

| Board | FQBN |
|-------|------|
| Arduino Uno | `arduino:avr:uno` |
| Arduino Nano | `arduino:avr:nano:cpu=atmega328` |
| Arduino Nano (Old Bootloader) | `arduino:avr:nano:cpu=atmega328old` |
| Arduino Mega 2560 | `arduino:avr:mega:cpu=atmega2560` |
| Arduino Leonardo | `arduino:avr:leonardo` |
| Arduino Micro | `arduino:avr:micro` |
```

**Response (error):**
```json
{
  "success": false,
  "error": "sketch.ino:5:1: error: expected ';' before '}' token",
  "output": "Full compiler output..."
}
```

### GET /health

Health check endpoint.

### GET /boards

List available boards and their FQBNs.

## Supported Boards

- Arduino Uno (`arduino:avr:uno`)
- Arduino Nano (`arduino:avr:nano:cpu=atmega328`)
- Arduino Nano (Old Bootloader) (`arduino:avr:nano:cpu=atmega328old`)
- Arduino Mega 2560 (`arduino:avr:mega:cpu=atmega2560`)
- Arduino Leonardo (`arduino:avr:leonardo`)
- Arduino Micro (`arduino:avr:micro`)

## Security Notes

- The service accepts code from any origin (CORS enabled)
- For production, consider adding rate limiting
- Consider adding authentication for paid/private use
