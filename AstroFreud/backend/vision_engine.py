import cv2
import os
from deepface import DeepFace

class ARESVision:
    def __init__(self, registration_photo: str = "vian.jpeg"):
        # Correct path logic for: AstroBurrus/backend/vision_engine.py
        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(current_dir)
        
        self.db_path = os.path.join(project_root, "face_db")
        self.ref_path = os.path.join(self.db_path, registration_photo)
        self.threshold = 0.40 

    def analyze_crew(self, frame) -> dict:
        try:
            identity = "Unknown Personnel"
            
            # 1. Identity Verification
            if os.path.exists(self.ref_path):
                verify = DeepFace.verify(
                    img1_path=frame,
                    img2_path=self.ref_path,
                    model_name="Facenet",
                    detector_backend="retinaface",
                    enforce_detection=False,
                )
                if verify["distance"] <= self.threshold:
                    identity = "VIAN"

            # 2. Emotion Analysis
            objs = DeepFace.analyze(
                img_path=frame,
                actions=["emotion"],
                detector_backend="opencv",
                enforce_detection=False,
            )

            emo = objs[0]["emotion"]
            mood = objs[0]["dominant_emotion"]

            # Weighted sensitivity
            if emo.get("sad", 0) > 20: mood = "sad"
            elif emo.get("angry", 0) > 20: mood = "angry"
            elif emo.get("fear", 0) > 15: mood = "fear"

            stress_matrix = {"sad": 14, "angry": 12, "fear": 16, "neutral": 3, "happy": 1}
            score = stress_matrix.get(mood, 5)

            return {"identity": identity, "mood": mood, "score": score}

        except Exception as e:
            return {"error": str(e)}