import { pgEnum } from 'drizzle-orm/pg-core';

export const userPriceReportStatusEnum = pgEnum('user_price_report_status', [
  'pending',
  'accepted',
  'disputed',
  'rejected',
  'superseded',
]);

export const userPriceReportVoteEnum = pgEnum('user_price_report_vote', [
  'confirm',
  'dispute',
]);

export const userReputationEventTypeEnum = pgEnum(
  'user_reputation_event_type',
  [
    'report_submitted',
    'report_confirmed',
    'report_disputed',
    'report_matched_official',
    'report_rejected',
    'abuse_penalty',
  ],
);
