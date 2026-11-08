-- 套餐描述（只在开台选套餐时给服务员看）最多 40 字：char_length，与前端 Array.from(s).length 一致。
-- 推到线上前先只读核对（有结果就先别推，由店主决定怎么处理）：
--   select id, restaurant_id, char_length(description) from public.buffets where char_length(description) > 40;
ALTER TABLE public.buffets
  DROP CONSTRAINT IF EXISTS buffets_description_length;
ALTER TABLE public.buffets
  ADD CONSTRAINT buffets_description_length
  CHECK (description IS NULL OR char_length(description) <= 40);
