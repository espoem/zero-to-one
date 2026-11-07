-- Anti-pattern: writes first, fails later. Redis does not roll back the first write.
-- KEYS[1] = a counter, KEYS[2] = a key that holds a non-integer string
redis.call('INCR', KEYS[1])
redis.call('INCR', KEYS[2]) -- raises: value is not an integer
return 'unreachable'
