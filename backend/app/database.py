from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

client: AsyncIOMotorClient = None
db = None


async def connect_db():
    global client, db
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.DATABASE_NAME]
    await create_indexes()


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
