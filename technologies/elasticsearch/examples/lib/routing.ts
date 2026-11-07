/**
 * Elasticsearch document routing:
 *
 * ES 9+ (IndexVersions.MOD_ROUTING_FUNCTION):
 *   shard_num = floorMod(murmur3_x86_32(utf16le(_routing), seed 0), num_primary_shards)
 *
 * ES 7.x / 8.x (legacy):
 *   routing_factor = num_routing_shards / num_primary_shards
 *   shard_num      = floorMod(murmur3_x86_32(utf16le(_routing), seed 0), num_routing_shards) / routing_factor
 *
 * `_routing` defaults to `_id`. In legacy versions, num_routing_shards
 * (index.number_of_routing_shards) defaulted to the largest power-of-two multiple
 * of the primary count that is <= 1024, so the index could later be `_split`.
 * In ES 9+, modulo routing splits directly: target shard j is split from source shard j % sourceShards.
 */

/** MurmurHash3 x86 32-bit (Austin Appleby), the variant Lucene's StringHelper implements. */
export function murmur3x86_32(bytes: Uint8Array, seed = 0): number {
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  let h1 = seed >>> 0;
  const len = bytes.length;
  const roundedEnd = len & ~3;
  for (let i = 0; i < roundedEnd; i += 4) {
    let k1 = bytes[i]! | (bytes[i + 1]! << 8) | (bytes[i + 2]! << 16) | (bytes[i + 3]! << 24);
    k1 = Math.imul(k1, c1);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, c2);
    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = (Math.imul(h1, 5) + 0xe6546b64) | 0;
  }
  let k1 = 0;
  switch (len & 3) {
    case 3:
      k1 = (bytes[roundedEnd + 2]! & 0xff) << 16;
    // falls through
    case 2:
      k1 |= (bytes[roundedEnd + 1]! & 0xff) << 8;
    // falls through
    case 1:
      k1 |= bytes[roundedEnd]! & 0xff;
      k1 = Math.imul(k1, c1);
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = Math.imul(k1, c2);
      h1 ^= k1;
  }
  h1 ^= len;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;
  return h1 | 0; // signed 32-bit, like Java's int
}

/** Murmur3HashFunction.hash(String): each UTF-16 code unit as 2 little-endian bytes. */
export function esRoutingHash(routing: string): number {
  return murmur3x86_32(new Uint8Array(Buffer.from(routing, 'utf16le')));
}

/** Java's Math.floorMod: result has the sign of the divisor. */
export function floorMod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** Default index.number_of_routing_shards for a given primary count (ES >= 7). */
export function defaultRoutingShards(primaries: number): number {
  if (primaries < 1) throw new Error('number_of_shards must be >= 1');
  // MetadataCreateIndexService.calculateNumRoutingShards: numShards << max(0, 10 - ceil(log2(numShards)))
  const log2Ceil = primaries === 1 ? 0 : 32 - Math.clz32(primaries - 1);
  return primaries * 2 ** Math.max(0, 10 - log2Ceil);
}

export function shardId(routing: string, primaries: number): number {
  if (primaries < 1) throw new Error('number_of_shards must be >= 1');
  return floorMod(esRoutingHash(routing), primaries);
}

/** Legacy ES 7.x/8.x routing with routing shards. */
export function legacyShardId(
  routing: string,
  primaries: number,
  routingShards = defaultRoutingShards(primaries),
): number {
  if (routingShards % primaries !== 0) {
    throw new Error(
      'illegal_argument_exception: the number of routing shards must be a multiple of the number of shards',
    );
  }
  const factor = routingShards / primaries;
  return Math.floor(floorMod(esRoutingHash(routing), routingShards) / factor);
}

/**
 * `_split` validity: the target primary count must be a multiple of the source count and
 * must divide number_of_routing_shards. `_shrink`: the target must be a factor of the source.
 */
export function canSplit(source: number, target: number, routingShards: number): boolean {
  return target > source && target % source === 0 && routingShards % target === 0;
}

export function canShrink(source: number, target: number): boolean {
  return target < source && source % target === 0;
}

/**
 * index.routing_partition_size: with custom routing, spread one routing value over
 * `partitionSize` shards: hash = hash(_routing) + floorMod(hash(_id), partition_size) (32-bit wrap),
 * then the usual floorMod / routing_factor.
 */
export function partitionedShardId(
  routing: string,
  id: string,
  primaries: number,
  partitionSize: number,
): number {
  if (partitionSize < 1 || partitionSize >= primaries)
    throw new Error(
      'illegal_argument_exception: routing partition size must be >= 1 and < number_of_shards',
    );
  // Modelled with routing shards == primaries (routing factor 1): partitioned indices cannot be split.
  const routingShards = primaries;
  const factor = 1;
  const offset = floorMod(esRoutingHash(id), partitionSize);
  return Math.floor(floorMod((esRoutingHash(routing) + offset) | 0, routingShards) / factor);
}
