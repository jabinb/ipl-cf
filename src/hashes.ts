import { ContentPrefix, HashesCacheTTL, HashesFileName, ManifestVersionName } from './constants';

export interface FileHash {
	/**
	 * Meant to denote the operation, seems unused, the patch client never deletes files, and always replaces
	 *   '-' remove
	 *   '+' add
	 *   '' ? nothing
	 */
	prefixedName: '-' | '+' | '';
	// Name of the UO file
	name: string;
	// MD5 hash of the file
	fileHash: string;
	// MD5 hash of the little-endian representation of the file size
	lengthHash: string;
	// Length of the file
	length: number;
}

/**
 * Builds the tab-delimited hash file returned by /hashes
 * @param hashes
 */
export const hashesToString = (hashes: FileHash[]) =>
	hashes
		.map(({ prefixedName, name, fileHash, lengthHash, length }) => `${prefixedName}${name}\t${fileHash}\t${lengthHash}\t${length}`)
		.join('\n');

/**
 * md5 checksum of an input buffer
 * This is not used for the file hashes (cloudflare ETAG is md5), this is purely for the file size hashing
 */
const md5 = (input: Uint8Array) =>
	crypto.subtle.digest({ name: 'MD5' }, input).then((digest) =>
		Array.from(new Uint8Array(digest))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join(''),
	);

/**
 * Retrieves the list of objects in the R2 bucket, and builds the hash file/length map the patching uses
 * By default caches the hash list for 60s, configurable by HashesCacheTTL constant
 * @param env
 * @param hashesFileName
 * @param hashesCacheTtl
 */
export const getHashes = async (env: Env, hashesFileName: string, hashesCacheTtl = HashesCacheTTL): Promise<FileHash[]> => {
	// We cache in KV the hashes to reduce the number of R2 calls as it's frequently used
	const hashes = await env.CONTENT_KV.get(hashesFileName).then(
		(content) =>
			content ??
			// Cache for hashes is stale or empty, fetch & store it from R2
			env.CLIENT_CONTENT.get(hashesFileName).then((o) => o?.text() ?? null),
	);

	// We found a cached version, serve it
	if (hashes) {
		return JSON.parse(hashes);
	}

	// There's no content for hashes in either KV or R2, we need to build it
	const { objects, truncated } = await env.CLIENT_CONTENT.list({
		prefix: ContentPrefix,
		limit: 1000,
	});

	// Build our list of file hashes, using the existing ETAG (md5) for the hash
	const fileHashes: FileHash[] = await Promise.all(
		objects.map(async (obj) => ({
			prefixedName: '', // Ignoring prefixed name, doesn't seem to be used?
			name: obj.key.replace(ContentPrefix, '/'),
			fileHash:
				obj.size > 0
					? obj.etag.toUpperCase() // Cloudflare ETAG is md5
					: // If size is empty, a hash of long 0 is used
					  await md5(new Uint8Array(8)),
			length: obj.size,
			lengthHash: (
				await md5(
					// For some reason the size is hashes in little-endian
					new Uint8Array(new BigInt64Array([BigInt(obj.size)]).buffer).reverse(),
				)
			).toUpperCase(),
		})),
	);

	// Store our list of hashes in KV, so we don't need to constantly recalc them
	await env.CONTENT_KV.put(hashesFileName, JSON.stringify(fileHashes), { expirationTtl: hashesCacheTtl });

	// Find the newest upload unix timestamp, use that as our manifest "version"
	// This should force the patch client to rescan the files every time a file is uploaded
	const version = Math.max(...objects.map((o) => Math.floor(o.uploaded.getTime() / 1000)));
	await env.CONTENT_KV.put(ManifestVersionName, `0.0.0.${version}`);

	return fileHashes;
};

export const getManifest = (env: Env, hashesFileName = HashesFileName) =>
	getHashes(env, hashesFileName).then((hashes) => hashes.map((v) => v.name));
