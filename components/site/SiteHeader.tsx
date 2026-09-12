import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LtrText } from "@/components/ui/LtrText";
import { PHONE, whatsappLink } from "@/content/channels";
import { COMPANY } from "@/content/company";
import { NAV_ITEMS, PRIMARY_CTA } from "@/content/navigation";
import { hrefIn } from "@/lib/i18n/pages";
import { getTranslator } from "@/lib/i18n/server";
import type { SwitcherData } from "@/lib/i18n/switcher";
import { LanguageMenu } from "./LanguageMenu";
import { SiteNav } from "./SiteNav";
import styles from "./SiteHeader.module.css";

/**
 * Server-rendered header. Only SiteNav (current page + mobile menu) and, when more than
 * one language is active, LanguageMenu run in the browser; the call to action, the icons
 * and every word are rendered here and handed to them, so Button, the icon set and the
 * catalogues stay out of the JavaScript every page loads.
 *
 * The logo is a plain <img> of a pre-sized file (public/brand/logo-96.png, 2× the 40px
 * it is shown at). Importing anything from next/image — even getImageProps — puts the
 * client Image component into the shared JavaScript, which a fixed-size mark does not need.
 *
 * The brand name and tagline stay in English in every language: they are the brand.
 */
export async function SiteHeader({ switcher }: { switcher: SwitcherData | null }) {
  const t = await getTranslator();
  const href = (path: string) => hrefIn(path, t.locale);
  const phone = <LtrText>{PHONE.value}</LtrText>;
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Link href={href("/")} className={styles.brandLink}>
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized static asset; see the note above */}
            <img src="/brand/logo-96.png" alt="" width={40} height={40} className={styles.logo} />
            <span className={styles.wordmark}>Go Gulf</span>
            <span className="visually-hidden">{t("common.homeSuffix")}</span>
          </Link>
          <span className={styles.tagline} lang={t.locale === "en" ? undefined : "en"}>
            {COMPANY.tagline}
          </span>
        </div>
        <SiteNav
          label={t("nav.label")}
          items={NAV_ITEMS.map((item) => ({ href: href(item.href), label: t(item.label) }))}
          cta={
            <Button href={href(PRIMARY_CTA.href)} size="sm">
              {t(PRIMARY_CTA.label)}
            </Button>
          }
          languageMenu={
            switcher ? (
              <LanguageMenu
                variant="menu"
                label={t("language.menuLabel")}
                currentLabel={t("language.current")}
                options={switcher.options}
                paths={switcher.paths}
                icon={<Icon name="globe" size={18} />}
              />
            ) : null
          }
          languageList={
            switcher ? (
              <LanguageMenu
                variant="list"
                label={t("language.menuLabel")}
                currentLabel={t("language.current")}
                options={switcher.options}
                paths={switcher.paths}
              />
            ) : null
          }
          icons={{
            menu: <Icon name="menu" size={22} />,
            close: <Icon name="close" size={22} />,
            chevron: <Icon name="chevron-right" size={20} />,
            whatsapp: <Icon name="whatsapp" size={20} />,
            phone: <Icon name="phone" size={20} />,
          }}
          text={{ menu: t("nav.menu"), close: t("nav.close"), talkToUs: t("nav.talkToUs"), opensWhatsApp: t("common.opensWhatsApp") }}
          whatsapp={{ href: whatsappLink(t("nav.whatsappGreeting")), label: t.rich("nav.whatsappNumber", { phone }) }}
          call={{ href: PHONE.href, label: t.rich("nav.callNumber", { phone }) }}
        />
      </div>
    </header>
  );
}
