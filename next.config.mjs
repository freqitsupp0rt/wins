/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: {
    // enables the compiler
    enabled: true,

    // allow development requests from specific origins (e.g., Vercel, local proxies)
    allowedDevOrigins: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://wins.freqitsolutions.net"
    ],
  },
};

export default nextConfig;
