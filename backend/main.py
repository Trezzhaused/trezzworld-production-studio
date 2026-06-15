from fastapi import FastAPI

app = FastAPI()

@app.get("/api/status")
def status():
    return {"status":"running","version":"0.1.0-alpha"}
