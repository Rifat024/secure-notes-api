import { env } from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Note } from '../src/models/Note.js';
import { Post } from '../src/models/Post.js';
import { usersByInterestPipeline, userPostsPipeline } from '../src/services/aggregations.js';

await connectDB(env.mongoUri);

const user = await User.findOne({ role: 'user', 'interests.0': { $exists: true } }).lean();
const note = await Note.findOne({ owner: user._id }).lean();
const post = await Post.findOne({ author: user._id }).lean();
if (!user || !note || !post) throw new Error('Run `npm run seed` first');

const stagesOf = (plan, acc = []) => {
  if (!plan || typeof plan !== 'object') return acc;
  if (plan.stage) acc.push(plan.indexName ? `${plan.stage}(${plan.indexName})` : plan.stage);
  for (const key of ['inputStage', 'queryPlan', 'winningPlan']) stagesOf(plan[key], acc);
  (plan.inputStages ?? []).forEach((p) => stagesOf(p, acc));
  return acc;
};

const findPlan = async (label, query) => {
  report(label, [...new Set(collectAggregateStages(await query.explain('queryPlanner')))]);
};

const collectAggregateStages = (node, acc = []) => {
  if (!node || typeof node !== 'object') return acc;
  if (node.queryPlanner) stagesOf(node.queryPlanner.winningPlan, acc);
  if (node.$cursor?.queryPlanner) stagesOf(node.$cursor.queryPlanner.winningPlan, acc);
  if (node.$lookup && node.indexesUsed) {
    acc.push(`$lookup ${node.$lookup.as}(${node.indexesUsed.join(', ') || 'no index'}, docsExamined=${node.totalDocsExamined})`);
  }
  Object.values(node).forEach((v) => (Array.isArray(v) ? v.forEach((x) => collectAggregateStages(x, acc)) : typeof v === 'object' && collectAggregateStages(v, acc)));
  return acc;
};

const aggPlan = async (label, Model, pipeline) => {
  const explained = await Model.aggregate(pipeline).explain('executionStats');
  report(label, [...new Set(collectAggregateStages(explained))]);
};

let failures = 0;
function report(label, stages) {
  const bad = stages.some((s) => s.startsWith('COLLSCAN') || s === 'SORT' || s.includes('no index'));
  if (bad) failures += 1;
  console.log(`${bad ? 'FAIL' : ' ok '}  ${label.padEnd(44)} ${stages.join(' <- ')}`);
}

console.log('Declared indexes:');
for (const Model of [User, Note, Post]) {
  const indexes = await Model.collection.indexes();
  console.log(`  ${Model.collection.name}: ${indexes.map((i) => JSON.stringify(i.key) + (i.unique ? ' unique' : '')).join(', ')}`);
}
console.log('\nWinning plans:');

await findPlan('login: users by email', User.findOne({ email: user.email }));
await findPlan('profile: user by _id', User.findById(user._id));
await findPlan('admin list users (sort _id desc)', User.find({}).sort({ _id: -1 }).limit(10));
await findPlan('list my notes (owner, sort _id desc)', Note.find({ owner: user._id }).sort({ _id: -1 }).limit(10));
await aggPlan('count my notes', Note, [{ $match: { owner: user._id } }, { $group: { _id: 1, n: { $sum: 1 } } }]);
await findPlan('get note (_id + owner)', Note.findOne({ _id: note._id, owner: user._id }));
await findPlan('admin list all notes (sort _id desc)', Note.find({}).sort({ _id: -1 }).limit(10));
await findPlan('admin notes filtered by owner', Note.find({ owner: user._id }).sort({ _id: -1 }).limit(10));
await findPlan('list posts (sort _id desc)', Post.find({}).sort({ _id: -1 }).limit(10));
await findPlan('get post by _id', Post.findById(post._id));
await aggPlan('scenario 1: users grouped by interest', User, usersByInterestPipeline({ skip: 0, limit: 10 }));
await aggPlan('scenario 1: filtered to one interest', User, usersByInterestPipeline({ interest: 'chess', skip: 0, limit: 10 }));
await aggPlan('scenario 2: user posts via $lookup', User, userPostsPipeline({ userId: user._id.toString(), skip: 0, limit: 10 }));

console.log(failures ? `\n${failures} query plan(s) need attention.` : '\nAll queries are index-backed with no in-memory sort.');
await disconnectDB();
process.exitCode = failures ? 1 : 0;
