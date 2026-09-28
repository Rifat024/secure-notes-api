import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { Role } from '../common/roles';
import { Note } from '../notes/schemas/note.schema';
import { Post } from '../posts/schemas/post.schema';
import { hashPassword, User } from '../users/schemas/user.schema';

const logger = new Logger('Seed');

const USER_PASSWORD = 'User@12345';
const PEOPLE = [
  { name: 'Alice Rahman', email: 'alice@example.com', interests: ['chess', 'reading'] },
  { name: 'Bilal Hossain', email: 'bilal@example.com', interests: ['football', 'chess'] },
  { name: 'Chaity Das', email: 'chaity@example.com', interests: ['reading', 'travel', 'photography'] },
  { name: 'Dipto Karim', email: 'dipto@example.com', interests: ['coding', 'chess'] },
  { name: 'Esha Noor', email: 'esha@example.com', interests: ['travel'] },
  { name: 'Farhan Ali', email: 'farhan@example.com', interests: [] },
];

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  try {
    const users = app.get<Model<User>>(getModelToken(User.name));
    const notes = app.get<Model<Note>>(getModelToken(Note.name));
    const posts = app.get<Model<Post>>(getModelToken(Post.name));

    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';

    await Promise.all([users.deleteMany({}), notes.deleteMany({}), posts.deleteMany({})]);

    const admin = await users.create({ name: 'Admin', email: adminEmail, password: adminPassword, role: Role.Admin, interests: ['coding'] });
    const userHash = await hashPassword(USER_PASSWORD);
    const members = await users.insertMany(PEOPLE.map((p) => ({ ...p, password: userHash, role: Role.User })));
    const everyone = [admin, ...members];

    await notes.insertMany(
      everyone.flatMap((u) =>
        Array.from({ length: 12 }, (_, i) => ({
          owner: u._id,
          title: `${u.name?.split(' ')[0]}'s note #${i + 1}`,
          content: `Private note ${i + 1} for ${u.name}.`,
        })),
      ),
    );
    await posts.insertMany(
      everyone.flatMap((u, index) =>
        Array.from({ length: 3 + index }, (_, i) => ({
          author: u._id,
          title: `${u.name?.split(' ')[0]} post #${i + 1}`,
          body: `Public post ${i + 1} written by ${u.name}.`,
        })),
      ),
    );

    logger.log(`Seeded ${everyone.length} users, ${await notes.estimatedDocumentCount()} notes, ${await posts.estimatedDocumentCount()} posts.`);
    logger.log(`Admin: ${adminEmail} / ${adminPassword}`);
    logger.log(`Users: ${PEOPLE.map((p) => p.email).join(', ')} / ${USER_PASSWORD}`);
  } finally {
    await app.close();
  }
}

seed().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
