import { parseVersionInfoBlock, readHeader, resGet, resTypeIds, parseResourceSection, rvaIndices, resolveRVA, IO } from 'exe-edit';
import { Buffer } from 'node:buffer';

export const readVersionFromLauncherFile = async (env: Env, fileKey: string): Promise<string> => {
	const fileObj = await env.CLIENT_CONTENT.get(fileKey);

	if (!fileObj) {
		throw new Error(`Launcher exe file does not exist: ${fileKey}`);
	}

	const data = Buffer.from(await fileObj.arrayBuffer());
	const io: IO = {
		read(position, length, buffer = Buffer.alloc(length), offset = 0) {
			buffer.set(data.subarray(position, position + length), offset);
			return buffer;
		},
		close(): void {},
		write(): void {},
	};

	const header = readHeader(io);
	const rva = resolveRVA(header, rvaIndices.resources);

	if (!rva) {
		throw new Error(`Malformed exe, resource header parsing failed`);
	}

	const table = parseResourceSection(io.read(rva.file.start, rva.file.size), rva.virtual.start);
	const versionResource = resGet(table, resTypeIds.RT_VERSION);

	if (!versionResource) {
		throw new Error(`Malformed exe, version resource not found`);
	}

	const block = parseVersionInfoBlock(versionResource.data);

	const [version] =
		block.children
			.find((b) => b.key === 'StringFileInfo')
			?.children.map((b) => b.children.find((b) => b.key === 'Assembly Version')?.value) ?? [];

	if (typeof version !== 'string') {
		throw new Error(`Malformed exe, version returned non-string value`);
	}

	return version;
};
