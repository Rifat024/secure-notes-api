import { Types } from 'mongoose';
import { userPostsPipeline } from '../../../../src/users/pipelines/user-posts.pipeline.js';
import { usersByInterestPipeline } from '../../../../src/users/pipelines/users-by-interest.pipeline.js';

const stageNames = (pipeline: object[]) => pipeline.map((stage) => Object.keys(stage)[0]);

describe('usersByInterestPipeline', () => {
  it('starts with an index-friendly $match and paginates inside one pipeline', () => {
    const pipeline = usersByInterestPipeline({ skip: 20, limit: 10 });
    expect(pipeline[0]).toEqual({ $match: { interests: { $gt: '' } } });
    expect(stageNames(pipeline)).toEqual(['$match', '$project', '$unwind', '$group', '$sort', '$facet', '$project']);
    const facet = (pipeline[5] as { $facet: { items: object[]; meta: object[] } }).$facet;
    expect(facet.items.slice(0, 2)).toEqual([{ $skip: 20 }, { $limit: 10 }]);
    expect(facet.meta).toEqual([{ $count: 'total' }]);
  });

  it('never projects the password hash', () => {
    expect((usersByInterestPipeline({ skip: 0, limit: 10 })[1] as { $project: object }).$project).not.toHaveProperty('password');
  });

  it('filters to one interest with a point lookup', () => {
    const pipeline = usersByInterestPipeline({ interest: 'chess', skip: 0, limit: 10 });
    expect(pipeline[0]).toEqual({ $match: { interests: 'chess' } });
    expect(pipeline[3]).toEqual({ $match: { interests: 'chess' } });
  });
});

describe('userPostsPipeline', () => {
  const userId = '64b7f0c2a1b2c3d4e5f60718';

  it('is one pipeline with $match on _id and two $lookup stages on author', () => {
    const pipeline = userPostsPipeline({ userId, skip: 5, limit: 5 }) as Record<string, any>[];
    expect(stageNames(pipeline)).toEqual(['$match', '$project', '$lookup', '$lookup', '$project']);
    expect(pipeline[0].$match._id).toBeInstanceOf(Types.ObjectId);
    expect(pipeline[2].$lookup).toMatchObject({ from: 'posts', localField: '_id', foreignField: 'author', as: 'posts' });
    expect(pipeline[2].$lookup.pipeline.slice(0, 3)).toEqual([{ $sort: { _id: -1 } }, { $skip: 5 }, { $limit: 5 }]);
    expect(pipeline[3].$lookup.pipeline).toEqual([{ $count: 'total' }]);
  });
});
