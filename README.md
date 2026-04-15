# StopBite 🦷🚫

StopBite is a cross-platform desktop application designed to help you stop biting your nails. Using real-time computer vision (MediaPipe), it monitors your webcam and triggers an alert sound when it detects your hand approaching your mouth.

## ✨ Features

- **Real-time Detection**: Uses Google MediaPipe for high-accuracy face and hand landmark tracking.
- **Smart Sensitivity**: Sophisticated logic to distinguish between nail-biting and other actions (like scratching your nose or cheek).
- **Custom Sounds**: Add your own alert sounds via the system menu.
- **Background Mode**: The app can be minimized to the system tray while remaining active.
- **Cross-Platform**: Available for Windows, macOS, and Linux.

## 🚀 Getting Started

### Installation

You can find the pre-built executables in the `dist/` folder:
- **Windows**: `StopBite 1.0.0.exe` (Portable)
- **macOS**: `StopBite-1.0.0-arm64.dmg`
- **Linux**: `StopBite-1.0.0-arm64.AppImage`

### Usage

1. Launch the application.
2. Grant camera permissions when prompted.
3. Position your webcam so your face and hands are clearly visible.
4. If you bring your hand too close to your mouth for more than 0.5 seconds, the alert will trigger!
5. **Add Sounds**: Go to `File > Aggiungi Suoni...` in the menu to load your own MP3/WAV files.

## 🛠️ Development

### Prerequisites

- [Bun](https://bun.sh/) runtime
- Node.js (for certain Electron build tools)

### Setup

```bash
# Install dependencies
bun install
```

### Run

```bash
# Start with live reload (nodemon)
bun run start
```

### Build

```bash
# Build for Windows (Portable)
bun run build:win

# Build for macOS (DMG)
bun run build:mac

# Build for Linux (AppImage)
bun run build:linux
```

## 🧠 How it Works

The app uses `FaceLandmarker` and `HandLandmarker` from MediaPipe. It calculates the proximity between hand fingertips and specific mouth landmarks (inner lip, philtrum). 

To prevent false positives, it implements:
- **Spatial Exclusion**: Ignores triggers if the hand is closer to the nose than the mouth.
- **Z-Axis Validation**: Ensures the hand is actually on the face surface and not just passing in front of the camera.
- **Horizontal Alignment**: Checks that the hand is within the horizontal bounds of the mouth.

## 📄 License

ISC License.
