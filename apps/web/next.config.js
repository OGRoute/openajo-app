/** @type {import('next').NextConfig} */
const nextConfig = {
  // The SDK ships TypeScript source; Next must transpile it.
  transpilePackages: ["@openajo/sdk"],
  // The SDK uses ESM-style ".js" specifiers in TS source; teach webpack to
  // resolve them to the .ts files. Turbopack has no equivalent of
  // extensionAlias, so the dev and build scripts pass --webpack.
  webpack: (config) => {
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return config;
  },
};
module.exports = nextConfig;
