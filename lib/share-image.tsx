import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { COMPANY } from "@/content/company";

/**
 * The interim social-share image (Open Graph and X), generated at build time.
 *
 * It replaces the old JPG, which carried unverified claims, offices that the site
 * does not list, a different phone number and a different domain. This one states
 * only verified facts: the brand and its line, the operating company, the registered
 * office's city, and the website. No phone number — those change; the page has them.
 */

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };
export const SHARE_IMAGE_ALT = `Go Gulf — a brand of ${COMPANY.legalName}, Lucknow, India`;

const INK = "#0e1a13";
const GREEN = "#157a3c";
const TEXT = "#3c4a42";
const SURFACE = "#f3f6f4";

export async function renderShareImage(): Promise<ImageResponse> {
  const root = process.cwd();
  const [regular, bold, logo] = await Promise.all([
    readFile(join(root, "assets/fonts/Mukta-Regular.ttf")),
    readFile(join(root, "assets/fonts/Mukta-Bold.ttf")),
    readFile(join(root, "public/brand/logo-512.png")),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#ffffff", fontFamily: "Mukta", position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, padding: "0 64px 0 80px" }}>
          <div style={{ fontSize: 112, fontWeight: 700, color: INK, lineHeight: 1 }}>Go Gulf</div>
          <div style={{ fontSize: 46, fontWeight: 700, color: GREEN, marginTop: 12 }}>{COMPANY.tagline}</div>
          <div style={{ width: 120, height: 5, background: GREEN, marginTop: 40, marginBottom: 36 }} />
          <div style={{ fontSize: 30, color: TEXT, lineHeight: 1.3 }}>{COMPANY.legalName}</div>
          {/* One text node per div: Satori needs display:flex on any div with several children. */}
          <div style={{ fontSize: 30, color: TEXT, lineHeight: 1.3 }}>
            {`Registered office: ${COMPANY.address.locality}, ${COMPANY.address.region}, India`}
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: INK, marginTop: 28 }}>{COMPANY.website}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 440, background: SURFACE }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered by Satori into a PNG, not a page */}
          <img src={logoSrc} width={340} height={340} alt="" />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 14, background: GREEN }} />
      </div>
    ),
    {
      ...SHARE_IMAGE_SIZE,
      fonts: [
        { name: "Mukta", data: regular, weight: 400, style: "normal" },
        { name: "Mukta", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
