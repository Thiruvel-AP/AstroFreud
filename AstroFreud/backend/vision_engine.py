import cv2
import os
import numpy as np
from deepface import DeepFace

class ARESVision:
    def __init__(self, registration_photo: str = "vian.jpeg"):
        current_dir  = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(current_dir)

        self.db_path  = os.path.join(project_root, "face_db")
        self.ref_path = os.path.join(self.db_path, registration_photo)

        # ── FIX 1: Facenet cosine threshold ──────────────────────────────────
        # Default DeepFace Facenet threshold is 0.40 (cosine).
        # Webcam JPEGs compressed through canvas are noisier than a clean photo,
        # so real-world distances land between 0.40–0.60.  Raise to 0.55.
        self.threshold = 0.55

        # ── FIX 2: Use a single consistent detector backend ──────────────────
        # retinaface is accurate but slow and fails on small/blurry faces.
        # opencv is fast & reliable for both verify + analyze.
        # Switch to "mtcnn" if opencv still fails — it handles tilted faces well.
        self.detector = "opencv"

        print(f"[ARES Vision] ref photo : {self.ref_path}")
        print(f"[ARES Vision] ref exists : {os.path.exists(self.ref_path)}")

    # ── FIX 3: Pre-process the incoming frame ────────────────────────────────
    # Canvas toDataURL gives a JPEG.  After base64 decode → cv2.imdecode the
    # array is already BGR.  DeepFace expects BGR numpy arrays, so we just
    # validate shape and make a writable copy (some numpy slices are read-only).
    def _preprocess(self, frame: np.ndarray) -> np.ndarray:
        if frame is None:
            raise ValueError("Null frame received")
        if frame.ndim == 2:                         # grayscale → BGR
            frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
        if frame.shape[2] == 4:                     # RGBA → BGR
            frame = cv2.cvtColor(frame, cv2.COLOR_RGBA2BGR)
        # Resize if the image is very small (helps detector find the face)
        h, w = frame.shape[:2]
        if w < 320:
            scale = 320 / w
            frame = cv2.resize(frame, (320, int(h * scale)),
                               interpolation=cv2.INTER_LINEAR)
        return np.ascontiguousarray(frame)          # ensure writable

    def analyze_crew(self, frame: np.ndarray) -> dict:
        try:
            frame    = self._preprocess(frame)
            identity = "Unknown Personnel"

            # ── Step 1: Identity verification ────────────────────────────────
            if os.path.exists(self.ref_path):
                try:
                    verify = DeepFace.verify(
                        img1_path   = frame,
                        img2_path   = self.ref_path,
                        model_name  = "Facenet",
                        detector_backend = self.detector,
                        enforce_detection = False,      # don't crash if no face
                        align       = True,
                    )
                    dist = verify["distance"]
                    verified = verify["verified"]
                    # Log so you can see what distance your face actually gets
                    print(f"[ARES Vision] distance={dist:.4f}  verified={verified}  "
                          f"threshold={self.threshold}")

                    # Use our raised threshold (DeepFace may use its own default)
                    if dist <= self.threshold:
                        identity = "VIAN"

                except Exception as ve:
                    # Verification failed (no face found etc.) — not fatal
                    print(f"[ARES Vision] Verify error: {ve}")

            # ── Step 2: Emotion analysis ──────────────────────────────────────
            try:
                objs = DeepFace.analyze(
                    img_path   = frame,
                    actions    = ["emotion"],
                    detector_backend = self.detector,
                    enforce_detection = False,
                    silent     = True,
                )
                emo  = objs[0]["emotion"]
                mood = objs[0]["dominant_emotion"]
                print(f"[ARES Vision] emotion={mood}  raw={emo}")

                # Weighted override for high-stress states
                if emo.get("sad",   0) > 20: mood = "sad"
                elif emo.get("angry", 0) > 20: mood = "angry"
                elif emo.get("fear",  0) > 15: mood = "fear"

            except Exception as ee:
                print(f"[ARES Vision] Emotion error: {ee}")
                mood = "neutral"

            stress_matrix = {
                "sad": 14, "angry": 12, "fear": 16,
                "neutral": 3, "happy": 1, "surprise": 6, "disgust": 10,
            }
            score = stress_matrix.get(mood, 5)

            return {"identity": identity, "mood": mood, "score": score}

        except Exception as e:
            print(f"[ARES Vision] CRASH: {e}")
            return {"error": str(e), "identity": "Unknown Personnel",
                    "mood": "neutral", "score": 0}