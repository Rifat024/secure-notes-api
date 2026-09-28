import type { PipelineStage } from 'mongoose';

export interface UsersByInterestOptions {
  interest?: string;
  skip: number;
  limit: number;
}

/**
 * Scenario 1: users grouped by interest. The leading $match is served by the multikey
 * { interests: 1 } index; pagination and the total are computed in-pipeline with $facet so the
 * whole view is a single aggregate round trip.
 */
export function usersByInterestPipeline({ interest, skip, limit }: UsersByInterestOptions): PipelineStage[] {
  const match = interest ? { interests: interest } : { interests: { $gt: '' } };
  return [
    { $match: match },
    { $project: { _id: 1, name: 1, email: 1, interests: 1 } },
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
