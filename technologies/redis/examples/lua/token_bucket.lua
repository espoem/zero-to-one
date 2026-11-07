-- Token bucket rate limiter, one hash per bucket.
-- KEYS[1] = bucket key
-- ARGV[1] = capacity (tokens), ARGV[2] = refill rate (tokens per second),
-- ARGV[3] = now (ms, passed by the caller so the script is deterministic), ARGV[4] = cost
-- Returns {allowed (1/0), tokens remaining (floored), retry-after ms}
local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])

local state = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(state[1])
local ts = tonumber(state[2])
if tokens == nil then
  tokens = capacity
  ts = now
end

-- Refill for the time elapsed since the last call (never above capacity, never backwards).
local elapsed = math.max(0, now - ts)
tokens = math.min(capacity, tokens + elapsed * rate / 1000)

local allowed = 0
local retry = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
else
  retry = math.ceil((cost - tokens) * 1000 / rate)
end

redis.call('HSET', KEYS[1], 'tokens', tostring(tokens), 'ts', tostring(now))
-- Expire idle buckets once they would be full again anyway.
redis.call('PEXPIRE', KEYS[1], math.ceil(capacity * 1000 / rate) + 1000)
return {allowed, math.floor(tokens), retry}
