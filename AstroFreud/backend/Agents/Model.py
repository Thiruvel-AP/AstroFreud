from langchain_ollama import ChatOllama


def model_chat() -> ChatOllama:
    llama_model = ChatOllama(
        model="llama3",
        temperature=0,
    )
    return llama_model