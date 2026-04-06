import { composeIntegrationNotes, parseIntegrationNotes } from "@/lib/domain/integration-notes";
import {
  decryptMetaCredentialSecret,
  encryptMetaCredentialSecret,
  type MetaCredentialSecret
} from "@/lib/integrations/credential-vault";
import { buildMetaSetupState } from "@/lib/integrations/meta";
import { integrationEnv } from "@/lib/integrations/config";
import { mapIntegrationConnectionRow } from "@/lib/supabase/mappers";

type MetaOAuthState = {
  provider: "facebook" | "instagram";
  clientId: string;
  connectionId?: string;
};

type MetaTokenExchangeResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
};

type MetaManagedPage = {
  id: string;
  name: string;
  access_token?: string;
  instagram_business_account?: {
    id: string;
    username?: string;
  };
};

async function getSupabaseServerClient() {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await serverModule.getSupabaseServerClient()) as any;
}

function assertMetaCredentials() {
  if (!integrationEnv.metaAppId || !integrationEnv.metaAppSecret || !integrationEnv.metaRedirectUri) {
    throw new Error(
      "Meta app configuration is incomplete. Set NEXT_PUBLIC_META_APP_ID, META_APP_SECRET, and NEXT_PUBLIC_META_REDIRECT_URI."
    );
  }
}

export function decodeMetaState(state: string): MetaOAuthState {
  const decoded =
    typeof Buffer !== "undefined"
      ? Buffer.from(state, "base64url").toString("utf8")
      : atob(state.replace(/-/g, "+").replace(/_/g, "/"));

  return JSON.parse(decoded) as MetaOAuthState;
}

async function exchangeCodeForUserToken(code: string) {
  assertMetaCredentials();

  const params = new URLSearchParams({
    client_id: integrationEnv.metaAppId,
    client_secret: integrationEnv.metaAppSecret,
    redirect_uri: integrationEnv.metaRedirectUri,
    code
  });
  const response = await fetch(
    `https://graph.facebook.com/v23.0/oauth/access_token?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("Meta code exchange failed.");
  }

  return (await response.json()) as MetaTokenExchangeResponse;
}

async function exchangeForLongLivedToken(accessToken: string) {
  assertMetaCredentials();

  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: integrationEnv.metaAppId,
    client_secret: integrationEnv.metaAppSecret,
    fb_exchange_token: accessToken
  });
  const response = await fetch(
    `https://graph.facebook.com/v23.0/oauth/access_token?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error("Meta long-lived token exchange failed.");
  }

  return (await response.json()) as MetaTokenExchangeResponse;
}

async function fetchManagedPages(accessToken: string) {
  const params = new URLSearchParams({
    fields: "id,name,access_token,instagram_business_account{id,username}",
    access_token: accessToken
  });
  const response = await fetch(`https://graph.facebook.com/v23.0/me/accounts?${params.toString()}`, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Meta page lookup failed.");
  }

  const payload = (await response.json()) as { data?: MetaManagedPage[] };
  return payload.data ?? [];
}

async function getRawIntegrationConnection(
  clientId: string,
  provider: "facebook" | "instagram"
) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase is required for live Meta connection handling.");
  }

  const { data, error } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("client_id", clientId)
    .eq("provider", provider)
    .maybeSingle();

  if (error || !data) {
    throw error ?? new Error("Meta connection not found.");
  }

  return data as Parameters<typeof mapIntegrationConnectionRow>[0];
}

export async function completeMetaOAuthCallback(code: string, state: string) {
  const decodedState = decodeMetaState(state);
  const rawConnection = await getRawIntegrationConnection(
    decodedState.clientId,
    decodedState.provider
  );
  const connection = mapIntegrationConnectionRow(rawConnection);

  const shortLivedToken = await exchangeCodeForUserToken(code);
  const longLivedToken = await exchangeForLongLivedToken(shortLivedToken.access_token);
  const managedPages = await fetchManagedPages(longLivedToken.access_token);

  const selectedPage =
    decodedState.provider === "instagram"
      ? managedPages.find((page) => page.instagram_business_account)
      : managedPages[0];

  if (!selectedPage) {
    throw new Error(
      decodedState.provider === "instagram"
        ? "No Instagram business account was available through Meta."
        : "No Facebook Page was available through Meta."
    );
  }

  const credentialSecret: MetaCredentialSecret = {
    provider: decodedState.provider,
    userAccessToken: shortLivedToken.access_token,
    longLivedAccessToken: longLivedToken.access_token,
    tokenExpiresAt: longLivedToken.expires_in
      ? new Date(Date.now() + longLivedToken.expires_in * 1000).toISOString()
      : undefined,
    pageId: selectedPage.id,
    pageName: selectedPage.name,
    pageAccessToken: selectedPage.access_token,
    instagramBusinessAccountId: selectedPage.instagram_business_account?.id,
    instagramUsername: selectedPage.instagram_business_account?.username
  };

  const setup = {
    ...connection.setup,
    ...buildMetaSetupState(decodedState.provider, decodedState.clientId, connection),
    authStatus: "connected" as const,
    tokenStatus: "ready" as const,
    authorizationUrl: undefined,
    externalAccountId:
      decodedState.provider === "instagram"
        ? selectedPage.instagram_business_account?.id ?? selectedPage.id
        : selectedPage.id,
    connectedAssetType:
      decodedState.provider === "instagram"
        ? ("instagram-business-account" as const)
        : ("facebook-page" as const),
    connectedAssetLabel:
      decodedState.provider === "instagram"
        ? selectedPage.instagram_business_account?.username ?? selectedPage.name
        : selectedPage.name,
    nextAction:
      "Connected. Next step is wiring live publish and sync execution against the stored Meta tokens.",
    lastCheckedAt: new Date().toISOString()
  };

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("integration_connections")
    .update({
      account_label:
        decodedState.provider === "instagram"
          ? selectedPage.instagram_business_account?.username ?? selectedPage.name
          : selectedPage.name,
      status: "Ready",
      last_sync_at: new Date().toISOString(),
      notes: composeIntegrationNotes(
        connection.notes,
        setup,
        encryptMetaCredentialSecret(credentialSecret)
      )
    })
    .eq("id", connection.id)
    .eq("client_id", decodedState.clientId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return {
    provider: decodedState.provider,
    connection: mapIntegrationConnectionRow(data as Parameters<typeof mapIntegrationConnectionRow>[0])
  };
}

export async function getStoredMetaCredentialSecret(
  clientId: string,
  provider: "facebook" | "instagram"
) {
  const rawConnection = await getRawIntegrationConnection(clientId, provider);
  const parsed = parseIntegrationNotes(rawConnection.notes);
  return decryptMetaCredentialSecret(parsed.secretBlob);
}
