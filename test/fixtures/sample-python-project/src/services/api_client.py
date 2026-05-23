from utils.validators import is_email

BASE_URL = "https://api.example.com"

class ApiClient:
    def __init__(self, base_url: str = BASE_URL, timeout: int = 5000):
        self.base_url = base_url
        self.timeout = timeout

    def get(self, endpoint: str, params: dict | None = None) -> dict:
        return {"endpoint": endpoint, "params": params or {}, "ok": True}

    def post(self, endpoint: str, data: dict) -> dict:
        if data.get("email") and not is_email(data["email"]):
            raise ValueError("Invalid email")
        return {"endpoint": endpoint, "data": data, "ok": True}

def create_client(config: dict) -> ApiClient:
    return ApiClient(config.get("base_url", BASE_URL), config.get("timeout", 5000))
