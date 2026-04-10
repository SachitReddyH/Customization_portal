from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
import logging

logger = logging.getLogger(__name__)

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    global client, db
    client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        tls=True,
        tlsAllowInvalidCertificates=True,   # works around Windows OpenSSL TLS handshake issues
        serverSelectionTimeoutMS=10_000,
        connectTimeoutMS=10_000,
    )
    db = client[settings.DATABASE_NAME]
    try:
        await create_indexes()
        logger.info("✅  Connected to MongoDB and indexes verified.")
    except Exception as exc:
        logger.error("⚠️  Could not create indexes on startup: %s", exc)
        # Server still starts — indexes will be created on first successful write


async def close_db():
    global client
    if client:
        client.close()


async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.villas.create_index("villa_number", unique=True)
    await db.customization_options.create_index("option_id", unique=True)
    await db.categories.create_index("category_id", unique=True)
    await db.locations.create_index("location_id", unique=True)
    await db.customer_selections.create_index("customer_id", unique=True)
    await db.quote_requests.create_index([("customer_id", 1), ("status", 1)])


def get_db():
    return db
