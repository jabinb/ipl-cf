interface Env {
	// https://developers.cloudflare.com/workers/runtime-apis/r2/
	CLIENT_CONTENT: R2Bucket;

	// https://developers.cloudflare.com/workers/runtime-apis/kv/
	CONTENT_KV: KVNamespace;

	ENVIRONMENT: 'development' | 'production';
	SHARD_NAME: string;
}
