import { RouteHandler, Router } from 'itty-router';
import { ContentPrefix, HashesFileName, ManifestFileName, ManifestVersionName } from './constants';
import { getHashes, getManifest, hashesToString } from './hashes';
import { readVersionFromLauncherFile } from './version';

export const router = (env: Env, ctx: ExecutionContext) => {
	const router = Router();

	const buildFileName = `${env.SHARD_NAME}Launcher.exe`;
	const appName = `${env.SHARD_NAME}.exe`;

	// GET collection index
	router.get('/version', handleVersion(env, buildFileName));
	router.get('/Version', handleVersion(env, buildFileName));

	// Launcher exe

	router.get('/download', handleStaticFile(env, buildFileName, appName));
	router.get('/update', handleStaticFile(env, buildFileName, appName));
	router.get(`${buildFileName}`, handleStaticFile(env, buildFileName, appName));
	router.get(`/${appName}`, handleStaticFile(env, buildFileName, appName));
	router.get(`/${appName}.bin`, handleStaticFile(env, buildFileName, appName));

	// manifest
	router.get('/Manifest', handleManifestContent(env));
	router.get('/manifest', handleManifestContent(env));
	router.get(`/${ManifestFileName}`, handleManifestContent(env));

	// hashes
	router.get('/hashes', handleHashesContent(env));
	router.get('/Hashes', handleHashesContent(env));
	router.get(`/${HashesFileName}`, handleHashesContent(env));

	router.get('/*', handleContentFile(env));

	return router;
};

/**
 * Simply streams a known file from R2 as a download, e.g. the launcher exe
 * @param env
 * @param fileName
 * @param downloadName
 * @param notFoundMessage
 */
const handleStaticFile =
	(
		env: Env,
		fileName: string,
		downloadName?: string,
		notFoundMessage: string = `${fileName} not found, has it been uploaded?`,
	): RouteHandler =>
	() =>
		env.CLIENT_CONTENT.get(fileName)
			.then((file) =>
				file
					? new Response(file.body, {
							status: 200,
							headers: downloadName && { 'Content-Disposition': `inline; filename="${downloadName}"` },
					  })
					: new Response(notFoundMessage, { status: 404 }),
			)
			.catch((e: Error) => new Response(`Error handling static file response: ${e.message}`, { status: 500 }));

/**
 * Examines the launcher exe, extracting the version number from the PE header
 * @param env
 * @param buildFileName
 */
const handleVersion =
	(env: Env, buildFileName: string): RouteHandler =>
	() =>
		readVersionFromLauncherFile(env, buildFileName)
			.then((version) => new Response(version, { status: 200 }))
			.catch((error) => new Response(error.toString(), { status: 500 }));

/**
 * Sends the hashes, rebuilding them or serving them from cache
 * @param env
 * @param hashesFileName
 */
const handleHashesContent =
	(env: Env, hashesFileName = HashesFileName): RouteHandler =>
	() =>
		getHashes(env, hashesFileName).then((m) => new Response(hashesToString(m), { status: 200 }));

/**
 * Sends the manifest, which is just a version (based on uploaded timestamp) + the hash list file names
 * @param env
 * @param hashesFileName
 */
const handleManifestContent =
	(env: Env, hashesFileName = HashesFileName): RouteHandler =>
	async () => {
		const manifest = await getManifest(env, hashesFileName);
		// Version gets updated by the latest file uploaded timestamp, see hashes.ts
		const manifestVersion = (await env.CONTENT_KV.get(ManifestVersionName)) ?? '0.0.0.1';
		return new Response([`[${manifestVersion}]`, ...manifest].join('\n'), { status: 200 });
	};

/**
 * Responds to the actual file download requests, only returns files that exist in the manifest
 * @param env
 */
const handleContentFile =
	(env: Env): RouteHandler =>
	async (request) => {
		const filePath = new URL(request.url).pathname;
		const manifest = await getManifest(env);
		const manifestFile = manifest.find((f) => f.toLowerCase() === filePath.toLowerCase());

		if (!manifestFile) {
			return new Response('File not found in manifest', { status: 404 });
		}

		const key = `${ContentPrefix}${manifestFile.replace(/^\//, '')}`;
		const [start, end]: [start: number, end: number] = request.headers
			.get('range')
			?.replace('bytes=', '')
			?.split('-')
			?.map((val: string) => parseInt(val)) ?? [0, 0];

		const isRangeRequest = start > 0 || end > 0;

		const file = await env.CLIENT_CONTENT.get(
			key,
			isRangeRequest
				? // Non-zero range
				  { range: { offset: start, length: end - start } }
				: undefined,
		);

		if (file === null) {
			return new Response(`Object Not Found: ${filePath}`, { status: 404 });
		}

		if (!isRangeRequest) {
			// Non-range request
			const headers = new Headers({
				etag: file.httpEtag,
				'Content-Type': 'application/octet-stream',
			});
			file.writeHttpMetadata(headers);
			return new Response(file.body, { status: 200, headers });
		} else {
			// Range request, pretty sure it doesn't get used, but copy the implementation of the C# server anyway
			const headers = new Headers({
				etag: file.httpEtag,
				'Content-Type': 'application/octet-stream',
				'Accept-Ranges': 'bytes',
				'Content-Range': `bytes ${start ?? 0}-${end ?? 1}/${file.size}`,
				'Content-Length': `${end - start}`,
			});
			file.writeHttpMetadata(headers);
			return new Response(file.body, { status: 206, headers });
		}
	};
