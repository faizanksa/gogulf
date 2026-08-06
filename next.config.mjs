/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: `npm run build` produces a plain HTML/CSS/JS bundle in `out/`
  // that can be uploaded as-is to any static host (cPanel, FTP/SFTP, Netlify,
  // Vercel, GitHub Pages) — same deployment story as the original hand-written
  // site, just with a build step in front of it now.
  output: 'export',
};

export default nextConfig;
