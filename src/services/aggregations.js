import mongoose from 'mongoose';

const PUBLIC_USER_FIELDS = { _id: 1, name: 1, email: 1 };

/**
 * Scenario 1: users grouped by interest. The leading $match is served by the multikey
 * { interests: 1 } index; pagination and the total are computed in-pipeline with $facet
 * so the whole view is a single aggregate round trip.
 */
export function usersByInterestPipeline({ interest, skip, limit }) {
  const match = interest ? { interests: interest } : { interests: { $gt: '' } };
  return [
    { $match: match },
    { $project: { ...PUBLIC_USER_FIELDS, interests: 1 } },
    { $unwind: '$interests' },
    ...(interest ? [{ $match: { interests: interest } }] : []),
    {
      $group: {
        _id: '$interests',
        count: { $sum: 1 },
        users: { $push: { _id: '$_id', name: '$name', email: '$email' } },
      },
    },
    { $sort: { count: -1, _id: 1 } },
    {
      $facet: {
        items: [{ $skip: skip }, { $limit: limit }, { $project: { _id: 0, interest: '$_id', count: 1, users: 1 } }],
        meta: [{ $count: 'total' }],
      },
    },
    { $project: { items: 1, total: { $ifNull: [{ $arrayElemAt: ['$meta.total', 0] }, 0] } } },
  ];
}

/**
 * Scenario 2: one user with a page of their posts. $match hits the _id index and the
 * $lookup sub-pipelines use { author: 1, _id: -1 } for both the sorted page and the count.
 */
export function userPostsPipeline({ userId, skip, limit }) {
  const _id = new mongoose.Types.ObjectId(userId);
  return [
    { $match: { _id } },
    { $project: { name: 1, interests: 1 } },
    {
      $lookup: {
        from: 'posts',
        localField: '_id',
        foreignField: 'author',
        pipeline: [
          { $sort: { _id: -1 } },
          { $skip: skip },
          { $limit: limit },
          { $project: { author: 0 } },
        ],
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
