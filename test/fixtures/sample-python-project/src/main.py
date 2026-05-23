from services.api_client import create_client
from services.user_service import UserService
from utils.math_utils import add, PI

def main():
    client = create_client({"base_url": "https://api.example.com", "timeout": 10000})
    service = UserService(client)
    user = service.get_user(1)
    print("User:", user)
    print("Sum:", add(10, 20))
    print("PI:", PI)

if __name__ == "__main__":
    main()
