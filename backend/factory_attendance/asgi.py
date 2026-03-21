import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import attendance.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'factory_attendance.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(attendance.routing.websocket_urlpatterns)
    ),
})
