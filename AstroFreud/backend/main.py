import base64
import cv2
import numpy as np
import os
import ollama
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from typing import List


from vision_engine import ARESVision 

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


ares = ARESVision()

# --- 2. DATA MODELS ---
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]

# --- 3. BIOMETRIC ANALYSIS ENDPOINT ---
@app.post("/analyze")
async def analyze(request: Request):
    try:
        # Receive and Decode Image
        data = await request.json()
        raw_image = data['image'].split(",")[1]
        nparr = np.frombuffer(base64.b64decode(raw_image), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return {"identity": "Error", "message": "Decode failed", "score": 0}

        # Run Vision Engine (RetinaFace + Facenet + Weighted Emotions)
        result = ares.analyze_crew(frame)

        # JSONABLE_ENCODER is critical: It converts NumPy types to standard JSON
        # Without this, the frontend will often receive a blank response/error.
        return jsonable_encoder({
            "identity": result.get("identity", "Unknown"),
            "mood": result.get("mood", "neutral"),
            "score": int(result.get("score", 0)),
            "message": f"Biometrics Verified. Subject identified as {result.get('identity')}."
        })

    except Exception as e:
        print(f"CRASH IN /ANALYZE: {e}")
        return {"identity": "Error", "message": str(e), "score": 0}

# --- 4. PSYCHIATRIC CHAT ENDPOINT ---
@app.post("/chat")
async def chat(req: ChatRequest):
    try:
        # Extract user messages to track progress in the psych evaluation
        user_msgs = [m for m in req.messages if m.role == 'user']
        
        # Fixed Psychiatric Triage Sequence
        psych_protocol = [
            "How has your sleep quality been over the last two cycles?",
            "Are you experiencing any difficulty focusing on mission objectives?",
            "Do you feel a sense of disconnection from the crew or mission control?",
            "I am processing your responses. Based on our data, I recommend a 15-minute Earth-audio session. Do you agree?"
        ]

        # If it's the start of a session, follow the script
        if 0 < len(user_msgs) <= 4:
            response_text = psych_protocol[len(user_msgs)-1]
        else:
            # Otherwise, use Llama 3 for intelligent empathy
            system_prompt = {
                "role": "system", 
                "content": "You are ARES, a Space Psychiatrist. Be clinical yet empathetic. Keep responses under 3 sentences."
            }
            # Convert Pydantic models to dicts for Ollama
            history = [system_prompt] + [m.dict() for m in req.messages]
            response = ollama.chat(model='llama3', messages=history)
            response_text = response['message']['content']

        return {"message": response_text}

    except Exception as e:
        print(f"CRASH IN /CHAT: {e}")
        return {"message": "Psych-link unstable. Please stand by."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)