const MINUTES_PER_DAY = 24 * 60;
const AGAIN_MINUTES = 10;
const FIRST_HARD_MINUTES = MINUTES_PER_DAY;
const FIRST_EASY_MINUTES = 3 * MINUTES_PER_DAY;
const MAX_INTERVAL_MINUTES = 60 * MINUTES_PER_DAY;

function nextIntervalMinutes(previousIntervalMinutes, rating) {
  if (rating === "again") return AGAIN_MINUTES;
  if (rating === "hard") {
    return Math.min(MAX_INTERVAL_MINUTES, Math.max(FIRST_HARD_MINUTES, Math.round((previousIntervalMinutes || 0) * 1.5)));
  }
  return Math.min(MAX_INTERVAL_MINUTES, Math.max(FIRST_EASY_MINUTES, Math.round((previousIntervalMinutes || 0) * 2)));
}

function buildReviewSchedule(previousProgress, rating, now = new Date()) {
  const intervalMinutes = nextIntervalMinutes(previousProgress?.intervalMinutes, rating);
  return {
    intervalMinutes,
    lastReviewedAt: now,
    nextReviewAt: new Date(now.getTime() + intervalMinutes * 60 * 1000),
  };
}

module.exports = {
  AGAIN_MINUTES,
  FIRST_EASY_MINUTES,
  FIRST_HARD_MINUTES,
  MAX_INTERVAL_MINUTES,
  buildReviewSchedule,
};
