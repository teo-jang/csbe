import asyncio
from sqlite3 import Connection

from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker


class BaseRepository:
    def __init__(self):
        self.engine = create_engine("sqlite+pysqlite:///csbe_study.db")
        self.async_engine = create_async_engine(
            "sqlite+aiosqlite:///csbe_study_async.db"
        )

        self.AsyncSession = sessionmaker(
            bind=self.async_engine, class_=AsyncSession, expire_on_commit=False
        )

    def create_table(self):
        with self.engine.connect() as conn:
            conn.execute(text("CREATE TABLE IF NOT EXISTS images(image_path text)"))
            conn.commit()

    async def create_table_async(self):
        async with self.async_engine.begin() as conn:
            await conn.execute(
                text("CREATE TABLE IF NOT EXISTS images(image_path text)")
            )

    def insert_sync(self, image_path):
        with self.engine.begin() as conn:
            for _ in range(5):
                conn.execute(
                    text("INSERT INTO images(image_path) VALUES(:image_path)"),
                    image_path,
                )
                conn.execute(
                    text("DELETE FROM images WHERE image_path =:image_path"), image_path
                )

            conn.execute(
                text("INSERT INTO images(image_path) VALUES(:image_path)"), image_path
            )

    async def insert_async(self, image_path):
        async with self.AsyncSession() as session:
            async with session.begin():
                for _ in range(5):
                    await session.execute(
                        text("INSERT INTO images(image_path) VALUES(:image_path)"),
                        image_path,
                    ),
                    await session.execute(
                        text("DELETE FROM images WHERE image_path =:image_path"),
                        image_path,
                    )

                await session.execute(
                    text("INSERT INTO images(image_path) VALUES(:image_path)"),
                    image_path,
                )
            await session.commit()
