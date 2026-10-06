import { cx } from "@/components/ui/cx";
import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translator";
import styles from "./ProcessSteps.module.css";

/**
 * The ten-step process, split by WHO handles each step (6 Oct 2026, D13): the first five
 * with Go Gulf (application and registration, counselling, document preparation, WRITTEN
 * DISCLOSURE of the agent, then referral only with the candidate's agreement — in that
 * order, enforced by content/public-claims.test.ts),
 * the last five with the registered recruiting agent, the employer and the authorities.
 * Go Gulf does not place candidates, so no step after the referral is described as ours.
 * Rendered on the home page and the job-seeker hub from this one source.
 *
 * Real ordered lists, numbered 1–10 across the two phases, in one of two layouts — never
 * a horizontal scroller:
 *   cards  a bordered panel per phase: two columns from tablets up, one on phones
 *   route  the phases as stops on one dotted line (the home page): across the page on
 *          wide screens, down its leading edge below that
 */

const PHASES: { title: MessageKey; steps: { title: MessageKey; body: MessageKey }[] }[] = [
  {
    title: "home.process.phase1",
    steps: [
      { title: "home.process.s1.title", body: "home.process.s1.body" },
      { title: "home.process.s2.title", body: "home.process.s2.body" },
      { title: "home.process.s3.title", body: "home.process.s3.body" },
      { title: "home.process.s4.title", body: "home.process.s4.body" },
      { title: "home.process.s5.title", body: "home.process.s5.body" },
    ],
  },
  {
    title: "home.process.phase2",
    steps: [
      { title: "home.process.s6.title", body: "home.process.s6.body" },
      { title: "home.process.s7.title", body: "home.process.s7.body" },
      { title: "home.process.s8.title", body: "home.process.s8.body" },
      { title: "home.process.s9.title", body: "home.process.s9.body" },
      { title: "home.process.s10.title", body: "home.process.s10.body" },
    ],
  },
];

/** Where each phase's steps start in the 1–10 sequence, worked out once rather than during render. */
const NUMBERED = PHASES.map((phase, i) => ({ ...phase, first: PHASES.slice(0, i).reduce((n, p) => n + p.steps.length, 0) + 1 }));

export async function ProcessSteps({ tone = "on-subtle", layout = "cards" }: { tone?: "on-subtle" | "on-white"; layout?: "cards" | "route" }) {
  const t = await getTranslator();
  return (
    <ol className={cx(styles.phases, layout === "route" ? styles.route : styles.cards, tone === "on-white" && styles.onWhite)}>
      {NUMBERED.map((phase, i) => (
        <li key={phase.title} className={styles.phase}>
          <p className={styles.phaseName}>
            <span className={styles.phaseNum} aria-hidden="true">
              {i + 1}
            </span>
            {t(phase.title)}
          </p>
          <ol className={styles.steps} start={phase.first}>
            {phase.steps.map((step, j) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNum} aria-hidden="true">
                  {String(phase.first + j).padStart(2, "0")}
                </span>
                <div>
                  <p className={styles.stepTitle}>{t(step.title)}</p>
                  <p className={styles.stepBody}>{t(step.body)}</p>
                </div>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}
