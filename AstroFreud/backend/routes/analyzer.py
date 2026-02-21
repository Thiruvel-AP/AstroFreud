import base64
import cv2
import numpy as np
from fastapi import APIRouter, Request
from fastapi.encoders import jsonable_encoder
from vision_engine import ARESVision

router = APIRouter()
ares = ARESVision()

@router.post("/analyze")
async def analyze(request: Request):
    try:
        data = await request.json()
        raw_image = data['image'].split(",")[1]
        nparr = np.frombuffer(base64.b64decode(raw_image), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return {"identity": "Error", "message": "Decode failed", "score": 0}

        result = ares.analyze_crew(frame)

        return jsonable_encoder({
            "identity": result.get("identity", "Unknown"),
            "mood": result.get("mood", "neutral"),
            "score": int(result.get("score", 0)),
            "message": f"Biometrics Verified. Subject identified as {result.get('identity')}."
        })

    except Exception as e:
        print(f"CRASH IN /ANALYZE: {e}")
        return {"identity": "Error", "message": str(e), "score": 0}