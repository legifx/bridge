-- Cache what the learn screen needs to re-render a bridge without calling the
-- model again: the match (interest, anchor, similarity) and the generated
-- widgets. Additive and nullable — older rows simply have no cache.
ALTER TABLE "Bridge" ADD COLUMN "renderJson" TEXT;
