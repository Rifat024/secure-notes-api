import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Note } from '../models/Note.js';
import { Post } from '../models/Post.js';

mongoose.set('strictQuery', true);

let connection = null;

export async function connectDB(uri) {
  if (connection) return connection;
  connection = mongoose
    .connect(uri, { serverSelectionTimeoutMS: 10000, autoIndex: false })
    .then(async (conn) => {
      // syncIndexes drops indexes that are no longer declared, keeping the database aligned with schema.index().
      await Promise.all([User.syncIndexes(), Note.syncIndexes(), Post.syncIndexes()]);
      return conn;
    })
    .catch((err) => {
      connection = null;
      throw err;
    });
  return connection;
}

export async function disconnectDB() {
  connection = null;
  await mongoose.disconnect();
}
