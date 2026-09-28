import { PipelineStage, Types } from 'mongoose';

export interface UserPostsOptions {
  userId: string;
  skip: number;
  limit: number;
}

/**
 * Scenario 2: one user with a page of their posts. $match hits the _id index and both $lookup
 * sub-pipelines use { author: 1, _id: -1 }, for the sorted page and for the covered count.
 */
export function userPostsPipeline({ userId, skip, limit }: UserPostsOptions): PipelineStage[] {
  return [
    { $match: { _id: new Types.ObjectId(userId) } },
    { $project: { name: 1, interests: 1 } },
    {
      $lookup: {
        from: 'posts',
        localField: '_id',
        foreignField: 'author',
        pipeline: [{ $sort: { _id: -1 } }, { $skip: skip }, { $limit: limit }, { $project: { author: 0 } }],
        as: 'posts',
      },
    },
    {
      $lookup: {
        from: 'posts',
        localField: '_id',
        foreignField: 'author',
        pipeline: [{ $count: 'total' }],
        as: 'postCount',
      },
    },
    {
      $project: {
        author: { _id: '$_id', name: '$name', interests: '$interests' },
        posts: 1,
        total: { $ifNull: [{ $arrayElemAt: ['$postCount.total', 0] }, 0] },
      },
    },
  ];
}
