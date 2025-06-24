# Backend: FastAPI Binance Portfolio API

## Setup

1. Create and activate a virtual environment (if not already):
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install fastapi uvicorn python-binance
   ```

## How to Start the Backend Server

1. **Open a terminal and navigate to the backend directory:**
   ```bash
   cd backend
   ```
2. **Activate your Python virtual environment:**
   ```bash
   source venv/bin/activate
   ```
3. **Start the FastAPI server on port 8000 (default):**
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   - If port 8000 is already in use, you can pick another port (e.g., 8001):
     ```bash
     uvicorn main:app --reload --port 8001
     ```
4. **To stop the server:**
   - Press `Ctrl+C` in the terminal where the server is running.

5. **If you see 'Address already in use':**
   - Make sure you don't have another instance of the server running.
   - You can check for running uvicorn processes and kill them:
     ```bash
     lsof -i :8000
     kill <PID>
     ```

## API Documentation

Interactive docs are available at:
- Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- ReDoc: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

## Testing the /balance Endpoint

**Checklist:**
- [ ] Set method to POST
- [ ] URL: `http://127.0.0.1:8000/balance`
- [ ] Set header: `Content-Type: application/json`
- [ ] Body: raw JSON
  ```json
  {
    "api_key": "YOUR_API_KEY",
    "api_secret": "YOUR_API_SECRET"
  }
  ```
- [ ] Send the request and view the response

### Example using `curl`
```bash
curl -X POST "http://127.0.0.1:8000/balance" \
  -H "Content-Type: application/json" \
  -d '{"api_key": "YOUR_API_KEY", "api_secret": "YOUR_API_SECRET"}'
```

### Example using Postman
- Set method to POST
- URL: `http://127.0.0.1:8000/balance`
- Body: raw JSON
  ```json
  {
    "api_key": "YOUR_API_KEY",
    "api_secret": "YOUR_API_SECRET"
  }
  ```
- Send the request and view the response 