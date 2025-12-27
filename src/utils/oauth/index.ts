/**
 * OAuth credential management for AI providers.
 *
 * This module handles login, token refresh, and credential storage
 * for OAuth-based providers:
 * - Anthropic (Claude Pro/Max)
*/

// Anthropic
export { loginAnthropic, refreshAnthropicToken } from "./anthropic.js";

// ============================================================================
// High-level API
// ============================================================================

import { refreshAnthropicToken } from "./anthropic.js";
import type { OAuthCredentials, OAuthProvider, OAuthProviderInfo } from "./types.js";


/**
 * Refresh token for any OAuth provider.
 * Saves the new credentials and returns the new access token.
 */
export async function refreshOAuthToken(
	provider: OAuthProvider,
	credentials: OAuthCredentials,
): Promise<OAuthCredentials> {
	if (!credentials) {
		throw new Error(`No OAuth credentials found for ${provider}`);
	}

	let newCredentials: OAuthCredentials;

	switch (provider) {
		case "anthropic":
			newCredentials = await refreshAnthropicToken(credentials.refresh);
			break;
		default:
			throw new Error(`Unknown OAuth provider: ${provider}`);
	}

	return newCredentials;
}

/**
 * Get API key for a provider from OAuth credentials.
 * Automatically refreshes expired tokens.
 *
 * For google-gemini-cli and antigravity, returns JSON-encoded { token, projectId }
 *
 * @returns API key string, or null if no credentials
 * @throws Error if refresh fails
 */
export async function getOAuthApiKey(
	provider: OAuthProvider,
	credentials: Record<string, OAuthCredentials>,
): Promise<{ newCredentials: OAuthCredentials; apiKey: string } | null> {
	let creds = credentials[provider];
	if (!creds) {
		return null;
	}

	// Refresh if expired
	if (Date.now() >= creds.expires) {
		try {
			creds = await refreshOAuthToken(provider, creds);
		} catch (_error) {
			throw new Error(`Failed to refresh OAuth token for ${provider}`);
		}
	}

	const apiKey = creds.access;
	return { newCredentials: creds, apiKey };
}

/**
 * Get list of OAuth providers
 */
export function getOAuthProviders(): OAuthProviderInfo[] {
	return [
		{
			id: "anthropic",
			name: "Anthropic (Claude Pro/Max)",
			available: true,
		}
	];
}
