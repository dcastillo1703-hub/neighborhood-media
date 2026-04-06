import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

type MetaCredentialSecret = {
  provider: "facebook" | "instagram";
  userAccessToken: string;
  longLivedAccessToken?: string;
  tokenExpiresAt?: string;
  pageId?: string;
  pageName?: string;
  pageAccessToken?: string;
  instagramBusinessAccountId?: string;
  instagramUsername?: string;
};

const ALGORITHM = "aes-256-gcm";

function getSecretKey() {
  const rawSecret = process.env.INTEGRATION_SECRET_KEY ?? "";

  if (!rawSecret.trim()) {
    throw new Error("INTEGRATION_SECRET_KEY is required for secure integration credential storage.");
  }

  return createHash("sha256").update(rawSecret).digest();
}

export function encryptMetaCredentialSecret(secret: MetaCredentialSecret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getSecretKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(secret), "utf8"),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    payload: encrypted.toString("base64")
  });
}

export function decryptMetaCredentialSecret(secretBlob?: string | null) {
  if (!secretBlob) {
    return null;
  }

  try {
    const parsed = JSON.parse(secretBlob) as {
      iv: string;
      authTag: string;
      payload: string;
    };
    const decipher = createDecipheriv(
      ALGORITHM,
      getSecretKey(),
      Buffer.from(parsed.iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(parsed.authTag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parsed.payload, "base64")),
      decipher.final()
    ]);

    return JSON.parse(decrypted.toString("utf8")) as MetaCredentialSecret;
  } catch {
    return null;
  }
}

export type { MetaCredentialSecret };
