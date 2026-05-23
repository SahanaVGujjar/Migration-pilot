from services.api_client import ApiClient
from utils.validators import is_email, is_required

class UserService:
    def __init__(self, client: ApiClient):
        self.client = client
        self._cache = {}

    def get_user(self, user_id: int) -> dict:
        if user_id in self._cache:
            return self._cache[user_id]
        user = self.client.get(f"/users/{user_id}")
        self._cache[user_id] = user
        return user

    def create_user(self, data: dict) -> dict:
        errors = self._validate(data)
        if errors:
            raise ValueError("; ".join(errors))
        user = self.client.post("/users", data)
        self._cache[user["id"]] = user
        return user

    def _validate(self, data: dict) -> list[str]:
        errors = []
        if not is_required(data.get("email")):
            errors.append("Email required")
        elif not is_email(data["email"]):
            errors.append("Invalid email")
        return errors
