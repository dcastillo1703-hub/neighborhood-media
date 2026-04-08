import { composeIntegrationNotes, parseIntegrationNotes } from "@/lib/domain/integration-notes";
import {
  decryptMetaCredentialSecret,
  encryptMetaCredentialSecret,
  type MetaCredentialSecret
} from "@/lib/integrations/credential-vault";
import { buildMetaSetupState } from "@/lib/integrations/meta";
import { integrationEnv } from "@/lib/integrations/config";
import {
  mapIntegrationConnectionInsert,
  mapIntegrationConnectionRow
} from "@/lib/supabase/mappers";
import type { IntegrationConnection, IntegrationSetup } from "@/types";

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

type MetaProfile = {
  id: string;
  name: string;
};

type MetaPermission = {
  permission: string;
  status: string;
};

function getPublicMetaAssets(
  provider: "facebook" | "instagram",
  managedPages: MetaManagedPage[]
): NonNullable<IntegrationSetup["availableAssets"]> {
  if (provider === "facebook") {
    return managedPages.map((page) => ({
      id: page.id,
      label: page.name,
      type: "facebook-page" as const
    }));
  }

  return managedPages
    .filter((page) => page.instagram_business_account)
    .map((page) => ({
      id: page.instagram_business_account!.id,
      label: page.instagram_business_account!.username ?? page.name,
      type: "instagram-business-account" as const,
      connectedPageId: page.id,
      username: page.instagram_business_account!.username
    }));
}

async function getSupabaseServerClient() {
  const serverModule = await import("@/lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await serverModule.getSupabaseServerClient()) as any;
}

function buildMetaScaffoldConnection(
  clientId: string,
  provider: "facebook" | "instagram"
): IntegrationConnection {
  return {
    id: `ic-${clientId}-${provider}`,
    clientId,
    provider,
    accountLabel: provider === "facebook" ? "Meta Facebook Page" : "Meta Instagram account",
    status: "Scaffolded",
    notes:
      provider === "facebook"
        ? "Ready for Meta Page connection and publish permissions."
        : "Ready for Instagram business account connection.",
    setup: {
      authStatus: "unconfigured",
      ...buildMetaSetupState(provider, clientId)
    }
  };
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

async function fetchMetaProfile(accessToken: string) {
  const params = new URLSearchParams({
    fields: "id,name",
    access_token: accessToken
  });
  const response = await fetch(`https://graph.facebook.com/v23.0/me?${params.toString()}`, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as MetaProfile;
}

async function fetchGrantedPermissions(accessToken: string) {
  const params = new URLSearchParams({
    access_token: accessToken
  });
  const response = await fetch(
    `https://graph.facebook.com/v23.0/me/permissions?${params.toString()}`,
    {
      method: "GET",
      cache: "no-store"
    }
  );

  if (!response.ok) {
    return [] as MetaPermission[];
  }

  const payload = (await response.json()) as { data?: MetaPermission[] };
  return payload.data ?? [];
}

async function ensureMetaIntegrationConnection(
  clientId: string,
  provider: "facebook" | "instagram"
) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase is required for live Meta connection handling.");
  }

  const scaffold = buildMetaScaffoldConnection(clientId, provider);
  const { data, error } = await supabase
    .from("integration_connections")
    .upsert(mapIntegrationConnectionInsert(scaffold), { onConflict: "id" })
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Unable to create Meta connection scaffold.");
  }

  return data as Parameters<typeof mapIntegrationConnectionRow>[0];
}

async function getRawIntegrationConnection(
  clientId: string,
  provider: "facebook" | "instagram",
  connectionId?: string
) {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase is required for live Meta connection handling.");
  }

  if (connectionId) {
    const { data, error } = await supabase
      .from("integration_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data as Parameters<typeof mapIntegrationConnectionRow>[0];
    }
  }

  const { data, error } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("client_id", clientId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return ensureMetaIntegrationConnection(clientId, provider);
  }

  return data as Parameters<typeof mapIntegrationConnectionRow>[0];
}

export async function completeMetaOAuthCallback(code: string, state: string) {
  const decodedState = decodeMetaState(state);
  const rawConnection = await getRawIntegrationConnection(
    decodedState.clientId,
    decodedState.provider,
    decodedState.connectionId
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
    const [profile, permissions] = await Promise.all([
      fetchMetaProfile(longLivedToken.access_token),
      fetchGrantedPermissions(longLivedToken.access_token)
    ]);
    const grantedPermissions = permissions
      .filter((permission) => permission.status === "granted")
      .map((permission) => permission.permission)
      .join(", ");

    throw new Error(
      decodedState.provider === "instagram"
        ? "No Instagram business account was available through Meta."
        : `No Facebook Page was available through Meta${profile?.name ? ` for ${profile.name}` : ""}. Granted permissions: ${grantedPermissions || "none returned"}.`
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
    instagramUsername: selectedPage.instagram_business_account?.username,
    availablePages: managedPages
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
    availableAssets: getPublicMetaAssets(decodedState.provider, managedPages),
    nextAction:
      "Connected. If this is not the right account, choose another available Meta asset in Settings.",
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

export async function selectMetaBusinessAsset(input: {
  clientId: string;
  provider: "facebook" | "instagram";
  assetId: string;
}) {
  const rawConnection = await getRawIntegrationConnection(input.clientId, input.provider);
  const connection = mapIntegrationConnectionRow(rawConnection);
  const parsed = parseIntegrationNotes(rawConnection.notes);
  const secret = decryptMetaCredentialSecret(parsed.secretBlob);

  if (!secret?.availablePages?.length) {
    throw new Error("No Meta account options are stored yet. Complete Meta login first.");
  }

  const selectedPage =
    input.provider === "instagram"
      ? secret.availablePages.find(
          (page) => page.instagram_business_account?.id === input.assetId
        )
      : secret.availablePages.find((page) => page.id === input.assetId);

  if (!selectedPage) {
    throw new Error("Selected Meta account was not found in the stored account options.");
  }

  const selectedLabel =
    input.provider === "instagram"
      ? selectedPage.instagram_business_account?.username ?? selectedPage.name
      : selectedPage.name;
  const nextSecret: MetaCredentialSecret = {
    ...secret,
    pageId: selectedPage.id,
    pageName: selectedPage.name,
    pageAccessToken: selectedPage.access_token,
    instagramBusinessAccountId: selectedPage.instagram_business_account?.id,
    instagramUsername: selectedPage.instagram_business_account?.username
  };
  const setup = {
    ...connection.setup,
    authStatus: "connected" as const,
    tokenStatus: "ready" as const,
    externalAccountId:
      input.provider === "instagram"
        ? selectedPage.instagram_business_account?.id ?? selectedPage.id
        : selectedPage.id,
    connectedAssetType:
      input.provider === "instagram"
        ? ("instagram-business-account" as const)
        : ("facebook-page" as const),
    connectedAssetLabel: selectedLabel,
    availableAssets: getPublicMetaAssets(input.provider, secret.availablePages),
    nextAction: "Connected to the selected Meta account.",
    lastCheckedAt: new Date().toISOString()
  };

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("integration_connections")
    .update({
      account_label: selectedLabel,
      status: "Ready",
      last_sync_at: new Date().toISOString(),
      notes: composeIntegrationNotes(
        connection.notes,
        setup,
        encryptMetaCredentialSecret(nextSecret)
      )
    })
    .eq("id", connection.id)
    .eq("client_id", input.clientId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapIntegrationConnectionRow(data as Parameters<typeof mapIntegrationConnectionRow>[0]);
}

export async function getStoredMetaCredentialSecret(
  clientId: string,
  provider: "facebook" | "instagram"
) {
  const rawConnection = await getRawIntegrationConnection(clientId, provider);
  const parsed = parseIntegrationNotes(rawConnection.notes);
  return decryptMetaCredentialSecret(parsed.secretBlob);
}
