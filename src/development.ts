import { RouteHandler } from 'itty-router';

/**
 * Development helper API for uploading assets to local R2 for testing
 * @param env
 */
export const putDevelopmentObject =
	(env: Env): RouteHandler =>
	async (request) => {
		try {
			const url = new URL(request.url);
			const key = url.pathname.replace('put/', '').replace(/^\//, '');

			switch (request.method) {
				case 'PUT': {
					await env.CLIENT_CONTENT.put(key, request.body);
					return new Response(`Put ${key} successfully!`);
				}

				default: {
					return new Response(`${request.method} is not allowed.`, {
						status: 405,
						headers: {
							Allow: 'PUT',
						},
					});
				}
			}
		} catch (e) {
			console.log(e);
		}
	};
