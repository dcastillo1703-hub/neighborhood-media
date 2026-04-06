export const integrationEnv = {
  metaAppId: process.env.NEXT_PUBLIC_META_APP_ID ?? "",
  metaAppSecret: process.env.META_APP_SECRET ?? "",
  metaRedirectUri:
    process.env.NEXT_PUBLIC_META_REDIRECT_URI ?? process.env.META_REDIRECT_URI ?? "",
  instagramAppId: process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID ?? "",
  googleBusinessAccountId: process.env.NEXT_PUBLIC_GBP_ACCOUNT_ID ?? "",
  googleAnalyticsPropertyId: process.env.NEXT_PUBLIC_GA4_PROPERTY_ID ?? "",
  tikTokAdvertiserId: process.env.NEXT_PUBLIC_TIKTOK_ADVERTISER_ID ?? "",
  reservationProvider: process.env.NEXT_PUBLIC_RESERVATION_PROVIDER ?? ""
};

export function isIntegrationConfigured(value: string) {
  return Boolean(value && value.trim().length > 0);
}
