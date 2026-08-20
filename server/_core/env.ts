export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  aiApiUrl: process.env.AI_API_BASE_URL ?? "",
  aiApiKey: process.env.AI_API_KEY ?? "",
  // Compatibility aliases for optional legacy modules being removed in the self-hosted migration.
  appId: "",
  oAuthServerUrl: "",
  ownerOpenId: "local-admin",
  forgeApiUrl: process.env.AI_API_BASE_URL ?? "",
  forgeApiKey: process.env.AI_API_KEY ?? "",
};
