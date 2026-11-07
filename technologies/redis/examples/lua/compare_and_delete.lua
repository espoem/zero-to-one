-- Release a lock only if this client still owns it.
-- KEYS[1] = lock key, ARGV[1] = owner token.
-- Returns 1 if deleted, 0 if the lock is missing or owned by someone else.
-- On Redis 8.4+ the same thing is one command: DELEX key IFEQ token.
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
