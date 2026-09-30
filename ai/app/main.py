from fastapi import FastAPI

app = FastAPI(title="FIRIS AI")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
