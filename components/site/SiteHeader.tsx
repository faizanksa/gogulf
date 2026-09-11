import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PHONE, whatsappLink } from "@/content/channels";
import { COMPANY } from "@/content/company";
import { NAV_ITEMS, PRIMARY_CTA } from "@/content/navigation";
import { SiteNav } from "./SiteNav";
import styles from "./SiteHeader.module.css";

/**
 * Server-rendered header. Only SiteNav (current page + mobile menu) runs in the browser;
 * the call to action and the icons are rendered here and handed to it as elements, so
 * Button and the icon set stay out of the JavaScript every page loads.
 *
 * The logo is a plain <img> of a pre-sized file (public/brand/logo-96.png, 2× the 40px
 * it is shown at). Importing anything from next/image — even getImageProps — puts the
 * client Image component into the shared JavaScript, which a fixed-size mark does not need.
 */
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Link href="/" className={styles.brandLink}>
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static asset; see the note above */}
            <img src="/brand/logo-96.png" alt="" width={40} height={40} className={styles.logo} />
            <span className={styles.wordmark}>Go Gulf</span>
            <span className="visually-hidden">, home</span>
          </Link>
          <span className={styles.tagline}>{COMPANY.tagline}</span>
        </div>
        <SiteNav
          items={NAV_ITEMS}
          cta={
            <Button href={PRIMARY_CTA.href} size="sm">
              {PRIMARY_CTA.label}
            </Button>
          }
          icons={{
            menu: <Icon name="menu" size={22} />,
            close: <Icon name="close" size={22} />,
            chevron: <Icon name="chevron-right" size={20} />,
            whatsapp: <Icon name="whatsapp" size={20} />,
            phone: <Icon name="phone" size={20} />,
          }}
          whatsappHref={whatsappLink("Hello Go Gulf, I have a question.")}
          phone={{ value: PHONE.value, href: PHONE.href }}
        />
      </div>
    </header>
  );
}
