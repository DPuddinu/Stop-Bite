import {
  FaceLandmarker,
  HandLandmarker,
  FilesetResolver
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest';
const { ipcRenderer } = window.require('electron');

const video = document.getElementById('webcam');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusElement = document.getElementById('status');

let faceLandmarker;
let handLandmarker;
let runningMode = 'VIDEO';
let lastVideoTime = -1;
let videoStream = null;
let soundFiles = [];
const audioPlayer = new Audio();
let currentSoundIndex = 0;

let proximityStartTime = null;
let lastProximityTime = 0;
const PROXIMITY_REQUIRED_DURATION = 400; // Sustained for 400ms
const PROXIMITY_GRACE_PERIOD = 250; // Allow 250ms of flicker before resetting timer

ipcRenderer.on('update-sounds', (event, files) => {
  soundFiles = files;
  currentSoundIndex = 0; // Reset index to ensure sequential play from start
  console.log('Suoni caricati:', soundFiles);
});

const scream = () => {
  // Stop any ongoing SpeechSynthesis
  window.speechSynthesis.cancel();

  // Stop current audio immediately
  try {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
  } catch (e) {
    console.error("Error pausing audio:", e);
  }

  if (soundFiles.length > 0) {
    const nextSound = soundFiles[currentSoundIndex];
    console.log(`Playing sound [${currentSoundIndex + 1}/${soundFiles.length}]: ${nextSound}`);
    currentSoundIndex = (currentSoundIndex + 1) % soundFiles.length;

    // Only update src if it's different or if we want to restart
    audioPlayer.src = nextSound;
    audioPlayer.load(); // Force reload to ensure it's ready
    
    // Play with a small delay to ensure cleanup happened
    setTimeout(() => {
      audioPlayer.play().catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Errore riproduzione audio:', err);
        }
      });
    }, 50);
  } else {
    const utterance = new SpeechSynthesisUtterance('nails');
    utterance.rate = 1.5;
    utterance.pitch = 2.0;
    window.speechSynthesis.speak(utterance);
  }

  statusElement.innerHTML = '<span class="warning">NAILS!</span>';
  statusElement.classList.add('warning');
  setTimeout(() => {
    statusElement.innerHTML = 'Watching...';
    statusElement.classList.remove('warning');
  }, 500);
};

async function initializeMediaPipe() {
  try {
    console.log('Initializing MediaPipe...');
    statusElement.innerText = 'Loading MediaPipe WASM...';
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

    statusElement.innerText = 'Loading Models...';
    console.log('Loading Face Landmarker...');
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
        delegate: 'GPU'
      },
      outputFaceBlendshapes: true,
      runningMode,
      numFaces: 1
    });

    console.log('Loading Hand Landmarker...');
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: 'GPU'
      },
      runningMode,
      numHands: 2,
      minHandDetectionConfidence: 0.4, 
      minHandPresenceConfidence: 0.4,
      minTrackingConfidence: 0.4
    });

    console.log('MediaPipe initialized successfully.');
    statusElement.innerText = 'Webcam starting...';
    startWebcam();
  } catch (err) {
    console.error('Initialization error:', err);
    statusElement.innerHTML = `<span class="warning">Init Error: ${err.message}</span>`;
  }
}

async function startWebcam() {
  const constraints = { video: true };
  try {
    videoStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = videoStream;
    video.onloadeddata = () => {
      predictWebcam();
    };
    statusElement.innerText = 'Watching...';
  } catch (err) {
    console.error('Error starting webcam:', err);
    statusElement.innerText = 'Webcam error: ' + err.message;
  }
}

let lastScreamTime = 0;
const SCREAM_COOLDOWN = 2000;

function predictWebcam() {
  if (video.paused || video.ended) {
    console.log('Video paused or ended');
    return;
  }

  if (lastVideoTime !== video.currentTime) {
    lastVideoTime = video.currentTime;
    const startTimeMs = performance.now();

    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Use squared distance to avoid Math.sqrt for better performance
    try {
      const faceResult = faceLandmarker.detectForVideo(video, startTimeMs);
      const handResult = handLandmarker.detectForVideo(video, startTimeMs);

      // Draw hand landmarks even if face is not detected
      if (handResult.landmarks && handResult.landmarks.length > 0) {
        for (const landmarks of handResult.landmarks) {
          const fingerTips = [4, 8, 12, 16, 20];
          for (const tipIdx of fingerTips) {
            const tip = landmarks[tipIdx];
            canvasCtx.fillStyle = '#FF0000';
            canvasCtx.beginPath();
            canvasCtx.arc(tip.x * canvasElement.width, tip.y * canvasElement.height, 5, 0, 2 * Math.PI);
            canvasCtx.fill();
          }
        }
      }

      if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
        const faceLandmarks = faceResult.faceLandmarks[0];
        // Landmarks:
        // 0: Upper lip top center
        // 13: Inner lower lip center
        // 17: Lower lip bottom center
        // 1: Nose tip
        // 164: Philtrum (just below nose, above upper lip)
        const mouthLandmark = faceLandmarks[13]; 
        const mouthLeft = faceLandmarks[61]; 
        const mouthRight = faceLandmarks[291]; 
        const mouthTop = faceLandmarks[0]; 
        const mouthBottom = faceLandmarks[17]; 
        const noseTip = faceLandmarks[1]; 
        const philtrum = faceLandmarks[164];

        // Draw mouth target area (for debugging)
        canvasCtx.strokeStyle = '#00FF00';
        canvasCtx.lineWidth = 2;
        const mouthWidth = Math.abs(mouthRight.x - mouthLeft.x);
        const marginX = mouthWidth * 0.15; // Tightened margin for cheeks
        const minX = Math.min(mouthLeft.x, mouthRight.x) - marginX;
        const maxX = Math.max(mouthLeft.x, mouthRight.x) + marginX;
        
        // Define a tighter vertical range: strictly mouth area
        const upperYBound = mouthTop.y; 
        const lowerYBound = mouthBottom.y + (mouthBottom.y - mouthTop.y) * 0.3;

        // Draw the target box
        canvasCtx.strokeRect(
          minX * canvasElement.width,
          upperYBound * canvasElement.height,
          (maxX - minX) * canvasElement.width,
          (lowerYBound - upperYBound) * canvasElement.height
        );

        if (handResult.landmarks && handResult.landmarks.length > 0) {
          let closeToMouth = false;
          for (const landmarks of handResult.landmarks) {
            const fingerTips = [4, 8, 12, 16, 20];
            for (const tipIdx of fingerTips) {
              const tip = landmarks[tipIdx];

              const dx = tip.x - mouthLandmark.x;
              const dy = tip.y - mouthLandmark.y;
              const distSq = dx * dx + dy * dy;

              // Tighter distance threshold
              if (distSq < 0.006) {
                // 1. Horizontal alignment with the mouth area
                const withinX = tip.x >= minX && tip.x <= maxX;
                
                // 2. Vertical alignment
                const withinY = tip.y > upperYBound && tip.y < lowerYBound;

                // 3. EXCLUSION: Ignore if it's closer to the nose than the mouth
                const distToNoseSq = Math.pow(tip.x - noseTip.x, 2) + Math.pow(tip.y - noseTip.y, 2);
                const clearlyCloserToNose = distToNoseSq < distSq * 1.0;

                // 4. DEPTH: Tight depth match
                const dz = Math.abs(tip.z - mouthLandmark.z);
                const depthMatch = dz < 0.038; 

                if (withinX && withinY && !clearlyCloserToNose && depthMatch) {
                  closeToMouth = true;
                  break;
                }
              }
            }
            if (closeToMouth) break;
          }

          if (closeToMouth) {
            const now = Date.now();
            lastProximityTime = now;

            // Start timer if first time close
            if (proximityStartTime === null) {
              proximityStartTime = now;
            }

            // Check if required duration has passed
            if (now - proximityStartTime >= PROXIMITY_REQUIRED_DURATION) {
              if (now - lastScreamTime > SCREAM_COOLDOWN) {
                console.log('Mouth and hand proximity sustained! Screaming...');
                scream();
                lastScreamTime = now;
                // Reset timer after scream
                proximityStartTime = null;
              }
            }
          } else {
            // Only reset if proximity has been lost for more than the grace period
            const now = Date.now();
            if (proximityStartTime !== null && (now - lastProximityTime > PROXIMITY_GRACE_PERIOD)) {
              proximityStartTime = null;
            }
          }
        } else {
          // No hands detected: use grace period before resetting
          const now = Date.now();
          if (proximityStartTime !== null && (now - lastProximityTime > PROXIMITY_GRACE_PERIOD)) {
            proximityStartTime = null;
          }
        }
      } else {
        // No face detected: use grace period before resetting
        const now = Date.now();
        if (proximityStartTime !== null && (now - lastProximityTime > PROXIMITY_GRACE_PERIOD)) {
          proximityStartTime = null;
        }
      }
    } catch (err) {
      console.error('Detection error:', err);
    }
  }
  // Set smaller timeout for faster response
  setTimeout(predictWebcam, 10);
}

initializeMediaPipe();
