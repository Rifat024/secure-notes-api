import mongoose from 'mongoose';
import { usersByInterestPipeline, userPostsPipeline } from '../../src/services/aggregations.js';

const stageNames = (pipeline) => pipeline.map((stage) => Object.keys(stage)[0]);

describe('usersByInterestPipeline', () => {
  test('starts with an index-friendly $match on interests', () => {
    const [first] = usersByInterestPipeline({ skip: 0, limit: 10 });
    expect(first).toEqual({ $match: { interests: { $gt: '' } } });
  });

  test('groups, sorts, and paginates inside a single pipeline', () => {
    const pipeline = usersByInterestPipeline({ skip: 20, limit: 10 });
    expect(stageNames(pipeline)).toEqual(['$match', '$project', '$unwind', '$group', '$sort', '$facet', '$project']);
    const facet = pipeline.find((s) => s.$facet).$facet;
    expect(facet.items.slice(0, 2)).toEqual([{ $skip: 20 }, { $limit: 10 }]);
    expect(facet.meta).toEqual([{ $count: 'total' }]);
  });

  test('never projects the password hash', () => {
    const project = usersByInterestPipeline({ skip: 0, limit: 10 })[1].$project;
    expect(project).not.toHaveProperty('password');
  });

  test('filters to one interest with a point lookup and a post-unwind match', () => {
    const pipeline = usersByInterestPipeline({ interest: 'chess', skip: 0, limit: 10 });
    expect(pipeline[0]).toEqual({ $match: { interests: 'chess' } });
    expect(pipeline[3]).toEqual({ $match: { interests: 'chess' } });
  });
});

describe('userPostsPipeline', () => {
  const userId = '64b7f0c2a1b2c3d4e5f60718';

  test('matches the user by _id as an ObjectId', () => {
    const [first] = userPostsPipeline({ userId, skip: 0, limit: 5 });
    expect(first.$match._id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(first.$match._id.toString()).toBe(userId);
  });

  test('joins posts with $lookup on author, sorted newest first and paginated', () => {
    const pipeline = userPostsPipeline({ userId, skip: 5, limit: 5 });
    const [postsLookup, countLookup] = pipeline.filter((s) => s.$lookup).map((s) => s.$lookup);
    expect(postsLookup).toMatchObject({ from: 'posts', localField: '_id', foreignField: 'author', as: 'posts' });
    expect(postsLookup.pipeline.slice(0, 3)).toEqual([{ $sort: { _id: -1 } }, { $skip: 5 }, { $limit: 5 }]);
    expect(countLookup.pipeline).toEqual([{ $count: 'total' }]);
  });

  test('is a single pipeline with exactly two $lookup stages', () => {
    expect(stageNames(userPostsPipeline({ userId, skip: 0, limit: 5 }))).toEqual(['$match', '$project', '$lookup', '$lookup', '$project']);
  });
});
