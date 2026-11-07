-- Sliding-window-counter rate limiter (approximation of a true sliding window).
-- KEYS[1] = counter of the current window, KEYS[2] = counter of the previous window.
--   The caller derives both names from floor(now / window) and gives them one hash tag
--   (e.g. "rl:{user42}:28837" and "rl:{user42}:28836"), so every key is declared in KEYS
--   and both live in one Cluster slot.
-- ARGV[1] = limit, ARGV[2] = window ms, ARGV[3] = now ms
-- Estimate = count(current) + count(previous) * (1 - elapsed fraction of the current window)
-- Returns {allowed (1/0), estimated count including this request if allowed (floored)}
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local cur = tonumber(redis.call('GET', KEYS[1]) or '0')
local prev = tonumber(redis.call('GET', KEYS[2]) or '0')
local elapsed = now % window
local estimate = cur + prev * (1 - elapsed / window)

if estimate + 1 > limit then
  return {0, math.floor(estimate)}
end
redis.call('INCR', KEYS[1])
-- Keep the counter for two windows so it can serve as "previous" in the next one.
redis.call('PEXPIRE', KEYS[1], window * 2)
return {1, math.floor(estimate + 1)}
