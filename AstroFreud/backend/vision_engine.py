import cv2
import os
import numpy as np
from collections import deque
from typing import Optional
from deepface import DeepFace


class ARESVision:
    """
    Optimized ARES Vision module.

    Improvements over v1
    ────────────────────
    1. Facenet512 replaces Facenet — 512-d embeddings are measurably more
       accurate on real-world / compressed webcam frames.
    2. Detector cascade — tries 'mtcnn' first (handles tilt, low-light),
       falls back to 'opencv' so we never silently drop a frame.
    3. Multi-reference support — loads every image in face_db/vian_refs/
       and takes the MINIMUM distance across all refs.  One clean selfie +
       a few angles beats a single photo every time.
    4. Adaptive threshold — starts at 0.55; if the running mean distance
       for a confirmed identity drifts, the threshold self-corrects within
       bounds [0.45, 0.65].
    5. Emotion smoothing — a rolling window of the last N frames prevents
       single-frame spikes from thrashing the dominant mood.
    6. Enhanced stress matrix — finer-grained scores and a composite
       'stress_index' that blends raw emotion weights.
    """

    DETECTOR_CHAIN = ["mtcnn", "opencv", "ssd"]   # tried in order
    MODEL          = "Facenet512"                  # 512-d > 128-d Facenet
    THRESHOLD_INIT = 0.55
    THRESHOLD_MIN  = 0.45
    THRESHOLD_MAX  = 0.65
    EMOTION_WINDOW = 3                   # shorter = more responsive

    STRESS_MATRIX = {
        "angry":   {"score": 14, "weight": 1.2},
        "fear":    {"score": 16, "weight": 1.3},
        "sad":     {"score": 12, "weight": 1.1},
        "neutral": {"score":  3, "weight": 0.5},
        "happy":   {"score":  1, "weight": 0.3},
    }

    def __init__(self, registration_photo: str = "vian.jpeg"):
        current_dir  = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(current_dir)

        self.db_path  = os.path.join(project_root, "face_db")
        self.ref_path = os.path.join(self.db_path, registration_photo)

        # Multi-reference: load all images from face_db/vian_refs/ if present
        refs_dir = os.path.join(self.db_path, "vian_refs")
        self.ref_paths: list[str] = []
        if os.path.isdir(refs_dir):
            for f in os.listdir(refs_dir):
                if f.lower().endswith((".jpg", ".jpeg", ".png")):
                    self.ref_paths.append(os.path.join(refs_dir, f))
        if not self.ref_paths and os.path.exists(self.ref_path):
            self.ref_paths = [self.ref_path]

        self.threshold   = self.THRESHOLD_INIT
        self._dist_buf   = deque(maxlen=20)          # for adaptive threshold
        self._emo_buf    = deque(maxlen=self.EMOTION_WINDOW)  # emotion window

        print(f"[ARES Vision] model      : {self.MODEL}")
        print(f"[ARES Vision] refs loaded : {len(self.ref_paths)}")
        for p in self.ref_paths:
            print(f"              → {p}  exists={os.path.exists(p)}")

    # Pre-processing 
    def _preprocess(self, frame: np.ndarray) -> np.ndarray:
        if frame is None:
            raise ValueError("Null frame received")
        if frame.ndim == 2:
            frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
        if frame.shape[2] == 4:
            frame = cv2.cvtColor(frame, cv2.COLOR_RGBA2BGR)
        h, w = frame.shape[:2]
        if w < 320:
            scale = 320 / w
            frame = cv2.resize(frame, (320, int(h * scale)),
                               interpolation=cv2.INTER_LINEAR)
        # Mild histogram equalization on the Y channel helps with dim lighting
        ycrcb = cv2.cvtColor(frame, cv2.COLOR_BGR2YCrCb)
        ycrcb[:, :, 0] = cv2.equalizeHist(ycrcb[:, :, 0])
        frame = cv2.cvtColor(ycrcb, cv2.COLOR_YCrCb2BGR)
        return np.ascontiguousarray(frame)

    #  Detector with automatic fallback 
    def _verify(self, frame: np.ndarray, ref: str) -> Optional[dict]:
        for backend in self.DETECTOR_CHAIN:
            try:
                result = DeepFace.verify(
                    img1_path        = frame,
                    img2_path        = ref,
                    model_name       = self.MODEL,
                    detector_backend = backend,
                    enforce_detection= False,
                    align            = True,
                )
                result["_backend"] = backend
                return result
            except Exception as e:
                print(f"[ARES Vision] verify/{backend} error: {e}")
        return None

    def _analyze_emotion(self, frame: np.ndarray) -> dict:
        for backend in self.DETECTOR_CHAIN:
            try:
                objs = DeepFace.analyze(
                    img_path         = frame,
                    actions          = ["emotion"],
                    detector_backend = backend,
                    enforce_detection= False,
                    silent           = True,
                )
                return objs[0]["emotion"]
            except Exception as e:
                print(f"[ARES Vision] emotion/{backend} error: {e}")
        return {}

    #  Adaptive threshold updater 
    def _update_threshold(self, dist: float, verified: bool) -> None:
        if verified:
            self._dist_buf.append(dist)
        if len(self._dist_buf) >= 5:
            mean_d = float(np.mean(self._dist_buf))
            # Nudge threshold to be 0.10 above the running mean, within bounds
            new_t = np.clip(mean_d + 0.10,
                            self.THRESHOLD_MIN, self.THRESHOLD_MAX)
            self.threshold = round(float(new_t), 4)
            print(f"[ARES Vision] adaptive threshold → {self.threshold:.4f}")

    #  Emotion smoothing 
    def _smooth_emotion(self, raw_emo: dict) -> tuple:
        """Average emotion scores across the rolling window, with bias toward strong signals."""
        if not raw_emo:
            return "neutral", {}

        self._emo_buf.append(raw_emo)
        keys = list(self.STRESS_MATRIX.keys())
        avg  = {k: float(np.mean([f.get(k, 0) for f in self._emo_buf]))
                for k in keys}

        dominant = max(avg, key=avg.get)

        #  Hard overrides: if any strong signal passes its threshold in the
        #    CURRENT raw frame, don't let the average bury it.
        #    Thresholds tuned for real-world compressed webcam frames.
        OVERRIDES = [
            ("angry",   15),
            ("sad",     10),  
            ("fear",    12),
            
        ]
        for emotion, threshold in OVERRIDES:
            if raw_emo.get(emotion, 0) > threshold:
                dominant = emotion
                print(f"[ARES Vision] override → {emotion} "
                      f"(raw={raw_emo[emotion]:.1f}% > {threshold}%)")
                break

        return dominant, avg

    # Public API
    def analyze_crew(self, frame: np.ndarray) -> dict:
        try:
            frame    = self._preprocess(frame)
            identity = "Unknown Personnel"
            min_dist = float("inf")
            best_ref = None

            # Identity: check all reference images, keep minimum distance 
            for ref in self.ref_paths:
                if not os.path.exists(ref):
                    continue
                result = self._verify(frame, ref)
                if result is None:
                    continue
                dist = result["distance"]
                print(f"[ARES Vision] ref={os.path.basename(ref)}  "
                      f"dist={dist:.4f}  backend={result['_backend']}")
                if dist < min_dist:
                    min_dist = dist
                    best_ref = ref

            if min_dist <= self.threshold:
                identity = "VIAN"
                self._update_threshold(min_dist, verified=True)

            print(f"[ARES Vision] best_dist={min_dist:.4f}  "
                  f"threshold={self.threshold:.4f}  identity={identity}")

            #  Emotion: raw → smooth 
            raw_emo = self._analyze_emotion(frame)
            mood, smooth_emo = self._smooth_emotion(raw_emo)

            print(f"[ARES Vision] mood={mood}  smooth={smooth_emo}")

            # Weighted stress index = Σ (score × weight × normalized_confidence)
            stress_index = sum(
                self.STRESS_MATRIX[k]["score"]
                * self.STRESS_MATRIX[k]["weight"]
                * (smooth_emo.get(k, 0) / 100)
                for k in self.STRESS_MATRIX
            )
            stress_index = round(stress_index, 2)

            # Discrete score for legacy consumers
            score = self.STRESS_MATRIX.get(mood, {"score": 5})["score"]

            return {
                "identity":     identity,
                "mood":         mood,
                "score":        score,
                "stress_index": stress_index,   
                "emotion_raw":  raw_emo,
                "emotion_avg":  smooth_emo,
                "distance":     round(min_dist, 4) if min_dist < float("inf") else None,
                "threshold":    self.threshold,
                "ref_used":     os.path.basename(best_ref) if best_ref else None,
            }

        except Exception as e:
            print(f"[ARES Vision] CRASH: {e}")
            return {
                "error":    str(e),
                "identity": "Unknown Personnel",
                "mood":     "neutral",
                "score":    0,
            }