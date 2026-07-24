-- Persist the check breakdown for the review log detail view (additive)
ALTER TABLE "Review" ADD COLUMN "detailJson" TEXT;
