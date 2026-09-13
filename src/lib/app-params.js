/**
 * Neutralized Base44 bootstrap leftover.
 * `src/pages/OAuthConsent.jsx` (unrouted MCP consent page) still imports this.
 * No @base44/sdk. Tokens are not used for the live auth path (Supabase).
 */

const isNode = typeof window === 'undefined';

const isClearAccessTokenRequested = () =>
	!isNode && new URLSearchParams(window.location.search).get("clear_access_token") === 'true';

const clearStoredAccessToken = () => {
	window.localStorage.removeItem('base44_access_token');
	window.localStorage.removeItem('token');
}

const getAppParams = () => {
	if (isClearAccessTokenRequested()) {
		clearStoredAccessToken();
	}
	return {
		appId: '',
		token: '',
		functionsVersion: '',
		appBaseUrl: '',
	}
}

export const appParams = {
	...getAppParams()
}
