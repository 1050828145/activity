-- 将activities表的first_hand_price字段重命名为profit
ALTER TABLE activities RENAME COLUMN first_hand_price TO profit;

-- 更新注释
COMMENT ON COLUMN activities.profit IS '利润';