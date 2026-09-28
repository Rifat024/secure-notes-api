import { env } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User, ROLES, hashPassword } from '../src/models/User.js';
import { Note } from '../src/models/Note.js';
import { Post } from '../src/models/Post.js';

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
const userPassword = 'User@12345';

const people = [
  { name: 'Alice Rahman', email: 'alice@example.com', interests: ['chess', 'reading'] },
  { name: 'Bilal Hossain', email: 'bilal@example.com', interests: ['football', 'chess'] },
  { name: 'Chaity Das', email: 'chaity@example.com', interests: ['reading', 'travel', 'photography'] },
  { name: 'Dipto Karim', email: 'dipto@example.com', interests: ['coding', 'chess'] },
  { name: 'Esha Noor', email: 'esha@example.com', interests: ['travel'] },
  { name: 'Farhan Ali', email: 'farhan@example.com', interests: [] },
];

await connectDB(env.mongoUri);
await Promise.all([User.deleteMany({}), Note.deleteMany({}), Post.deleteMany({})]);

const userHash = await hashPassword(userPassword);

const admin = await User.create({ name: 'Admin', email: adminEmail, password: adminPassword, role: ROLES.ADMIN, interests: ['coding'] });
const users = await User.insertMany(people.map((p) => ({ ...p, password: userHash, role: ROLES.USER })));

const everyone = [admin, ...users];
await Note.insertMany(
  everyone.flatMap((u) =>
    Array.from({ length: 12 }, (_, i) => ({ owner: u._id, title: `${u.name.split(' ')[0]}'s note #${i + 1}`, content: `Private note ${i + 1} for ${u.name}.` })),
  ),
);
await Post.insertMany(
  everyone.flatMap((u, idx) =>
    Array.from({ length: 3 + idx }, (_, i) => ({ author: u._id, title: `${u.name.split(' ')[0]} post #${i + 1}`, body: `Public post ${i + 1} written by ${u.name}.` })),
  ),
);

console.log(`Seeded ${everyone.length} users, ${await Note.estimatedDocumentCount()} notes, ${await Post.estimatedDocumentCount()} posts.`);
console.log(`Admin: ${adminEmail} / ${adminPassword}`);
console.log(`Users: ${people.map((p) => p.email).join(', ')} / ${userPassword}`);

await disconnectDB();
