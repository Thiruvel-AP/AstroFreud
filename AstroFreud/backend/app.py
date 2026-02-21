from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.analyzer import router as analyze_router
from routes.chatUI import router as chat_router

def create_app() -> FastAPI:
    app = FastAPI(title="ARES Psychological Evaluation System")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(analyze_router)
    app.include_router(chat_router)

    return app