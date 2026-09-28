import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model, PipelineStage, Query } from 'mongoose';
import { AppModule } from '../app.module';
import { Note } from '../notes/schemas/note.schema';
import { Post } from '../posts/schemas/post.schema';
import { userPostsPipeline } from '../users/pipelines/user-posts.pipeline';
import { usersByInterestPipeline } from '../users/pipelines/users-by-interest.pipeline';
import { User } from '../users/schemas/user.schema';

/**
 * Prints the winning plan for every query and aggregation the API runs and exits non-zero if any
 * of them needs a collection scan, an in-memory sort, or an unindexed $lookup.
 */
const logger = new Logger('Explain');

// Aggregation explain is rejected by the driver when the connection carries a write concern.
if (process.env.MONGODB_URI) {
  const uri = new URL(process.env.MONGODB_URI);
  uri.searchParams.delete('w');
  process.env.MONGODB_URI = uri.toString();
}

type Plan = Record<string, any>;

const stagesOf = (plan: Plan | undefined, acc: string[] = []): string[] => {
  if (!plan || typeof plan !== 'object') return acc;
  if (plan.stage) acc.push(plan.indexName ? `${plan.stage}(${plan.indexName})` : plan.stage);
  for (const key of ['inputStage', 'queryPlan', 'winningPlan']) stagesOf(plan?.[key], acc);
  (plan?.inputStages ?? []).forEach((p: Plan) => stagesOf(p, acc));
  return acc;
};

const collect = (node: Plan | undefined, acc: string[] = []): string[] => {
  if (!node || typeof node !== 'object') return acc;
  if (node.queryPlanner) stagesOf(node.queryPlanner?.winningPlan, acc);
  if (node.$cursor?.queryPlanner) stagesOf(node.$cursor.queryPlanner?.winningPlan, acc);
  if (node.$lookup && node.indexesUsed) {
    acc.push(`$lookup ${node.$lookup?.as}(${node.indexesUsed.join(', ') || 'no index'}, docsExamined=${node.totalDocsExamined})`);
  }
  Object.values(node).forEach((v) => (Array.isArray(v) ? v.forEach((x) => collect(x, acc)) : typeof v === 'object' && collect(v, acc)));
  return acc;
};

async function explain(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  let failures = 0;
  const report = (label: string, stages: string[]) => {
    const bad = stages.some((s) => s.startsWith('COLLSCAN') || s === 'SORT' || s.includes('no index'));
    if (bad) failures += 1;
    console.log(`${bad ? 'FAIL' : ' ok '}  ${label.padEnd(44)} ${stages.join(' <- ')}`);
  };
  const find = async (label: string, query: Query<unknown, unknown>) => report(label, [...new Set(collect((await query.explain('queryPlanner')) as Plan))]);
  const aggregate = async (label: string, model: Model<any>, pipeline: PipelineStage[]) =>
    report(label, [...new Set(collect((await model.aggregate(pipeline).explain('executionStats')) as Plan))]);

  try {
    const users = app.get<Model<User>>(getModelToken(User.name));
    const notes = app.get<Model<Note>>(getModelToken(Note.name));
    const posts = app.get<Model<Post>>(getModelToken(Post.name));

    const user = await users.findOne({ role: 'user', 'interests.0': { $exists: true } }).lean();
    const note = user && (await notes.findOne({ owner: user._id }).lean());
    const post = user && (await posts.findOne({ author: user._id }).lean());
    if (!user || !note || !post) throw new Error('No data found. Run `npm run seed` first.');

    console.log('Declared indexes:');
    for (const model of [users, notes, posts] as Model<any>[]) {
      const indexes = await model.collection.indexes();
      console.log(`  ${model.collection.name}: ${indexes.map((i) => JSON.stringify(i.key) + (i.unique ? ' unique' : '')).join(', ')}`);
    }
    console.log('\nWinning plans:');

    await find('login: users by email', users.findOne({ email: user.email }));
    await find('profile: user by _id', users.findById(user._id));
    await find('admin list users (sort _id desc)', users.find({}).sort({ _id: -1 }).limit(10));
    await find('list my notes (owner, sort _id desc)', notes.find({ owner: user._id }).sort({ _id: -1 }).limit(10));
    await aggregate('count my notes', notes, [{ $match: { owner: user._id } }, { $group: { _id: 1, n: { $sum: 1 } } }]);
    await find('get note (_id + owner)', notes.findOne({ _id: note._id, owner: user._id }));
    await find('admin list all notes (sort _id desc)', notes.find({}).sort({ _id: -1 }).limit(10));
    await find('admin notes filtered by owner', notes.find({ owner: user._id }).sort({ _id: -1 }).limit(10));
    await find('list posts (sort _id desc)', posts.find({}).sort({ _id: -1 }).limit(10));
    await find('get post by _id', posts.findById(post._id));
    await aggregate('scenario 1: users grouped by interest', users, usersByInterestPipeline({ skip: 0, limit: 10 }));
    await aggregate('scenario 1: filtered to one interest', users, usersByInterestPipeline({ interest: 'chess', skip: 0, limit: 10 }));
    await aggregate('scenario 2: user posts via $lookup', users, userPostsPipeline({ userId: String(user._id), skip: 0, limit: 10 }));

    console.log(failures ? `\n${failures} query plan(s) need attention.` : '\nAll queries are index-backed with no in-memory sort.');
    process.exitCode = failures ? 1 : 0;
  } finally {
    await app.close();
  }
}

explain().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
