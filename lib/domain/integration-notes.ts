import type { IntegrationConnection } from "@/types";

const SETUP_MARKER = "\n--- NMOS_SETUP ---\n";
const SECRET_MARKER = "\n--- NMOS_SECRET ---\n";

export function parseIntegrationNotes(notes: string) {
  const [plainNotes, serializedPayload] = notes.split(SETUP_MARKER);

  if (!serializedPayload) {
    return {
      plainNotes: plainNotes.trim(),
      setup: undefined,
      secretBlob: undefined
    };
  }

  const [serializedSetup, secretBlob] = serializedPayload.split(SECRET_MARKER);

  try {
    return {
      plainNotes: plainNotes.trim(),
      setup: JSON.parse(serializedSetup) as IntegrationConnection["setup"],
      secretBlob: secretBlob?.trim() || undefined
    };
  } catch {
    return {
      plainNotes: notes.trim(),
      setup: undefined,
      secretBlob: undefined
    };
  }
}

export function composeIntegrationNotes(
  plainNotes: string,
  setup?: IntegrationConnection["setup"],
  secretBlob?: string
) {
  const cleanedNotes = plainNotes.trim();

  if (!setup && !secretBlob) {
    return cleanedNotes;
  }

  const setupSection = setup ? `${SETUP_MARKER}${JSON.stringify(setup)}` : "";
  const secretSection = secretBlob ? `${SECRET_MARKER}${secretBlob}` : "";

  return `${cleanedNotes}${setupSection}${secretSection}`;
}
