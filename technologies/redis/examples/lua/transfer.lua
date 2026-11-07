-- Move `amount` from one integer balance to another, refusing to go negative.
-- KEYS[1] = from, KEYS[2] = to, ARGV[1] = amount
-- Validates BEFORE writing: a script has no rollback, so a failure after a write would leave
-- the first write applied.
local amount = tonumber(ARGV[1])
if amount == nil or amount <= 0 then
  return redis.error_reply('ERR amount must be a positive number')
end
local from = tonumber(redis.call('GET', KEYS[1]) or '0')
if from < amount then
  return redis.error_reply('ERR insufficient funds')
end
redis.call('DECRBY', KEYS[1], amount)
redis.call('INCRBY', KEYS[2], amount)
return {from - amount, tonumber(redis.call('GET', KEYS[2]))}
