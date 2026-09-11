import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import { DevNotice } from "@/components/site/DevNotice";
import { PageHeader } from "@/components/site/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container, Section } from "@/components/ui/Layout";
import { whatsappLink } from "@/content/channels";
import { formatSalary, getJob, jobIsClosed, visibleJobs, type Job } from "@/content/jobs";
import { jobPostingJsonLd } from "@/lib/job-posting";
import { buildMetadata } from "@/lib/seo";
import styles from "./job.module.css";

/**
 * One page per job — the only place JobPosting structured data may appear.
 *
 * Foundation page (Phase 2B): the data flow, metadata, structured-data rules and apply
 * links are final; the visual design is finished in 2C-1.
 *
 * Unknown slugs 404. Unconfirmed jobs render only outside production, flagged, noindex
 * and without JobPosting. Hourly regeneration moves a job to "closed" on its closing
 * date without a deploy.
 */
export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return visibleJobs().map((j) => ({ slug: j.slug }));
}

const where = (j: Job) => (j.city ? `${j.city}, ${j.country}` : j.country);

function trimTo(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, text.lastIndexOf(" ", max - 1))}…`;
}

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00Z`));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const job = getJob(slug);
  if (!job) return {};
  return buildMetadata({
    path: `/jobs/${job.slug}`,
    title: `${job.title} in ${where(job)}`,
    description: trimTo(`${job.title} job in ${where(job)} listed by Go Gulf. ${job.summary}`, 160),
    noIndex: job.verification !== "confirmed" || jobIsClosed(job),
  });
}

export default async function JobPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const job = getJob(slug);
  if (!job) notFound();

  const closed = jobIsClosed(job);
  const salary = formatSalary(job.salary);
  const schema = closed ? null : jobPostingJsonLd(job);
  const applyHref = `/jobs/apply?${new URLSearchParams({ job: job.title, country: job.country, type: job.employmentType }).toString()}`;
  const askHref = whatsappLink(`Hello Go Gulf, I would like to know more about the ${job.title} job in ${where(job)} (ref ${job.slug}).`);

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: "Location", value: where(job) },
    { label: "Industry", value: job.industry },
    { label: "Contract", value: job.employmentType },
    { label: "Salary", value: salary ? <span className={styles.mono}>{salary}</span> : "Not stated" },
    { label: "Posted", value: <time dateTime={job.postedOn}>{formatDate(job.postedOn)}</time> },
    {
      label: "Closes",
      value: job.closesOn ? <time dateTime={job.closesOn}>{formatDate(job.closesOn)}</time> : "No closing date given",
    },
    ...(job.openings ? [{ label: "Openings", value: String(job.openings) }] : []),
  ];

  return (
    <>
      {schema ? <JsonLd data={schema} /> : null}
      <PageHeader
        crumbs={[
          { name: "Jobs", path: "/jobs" },
          { name: job.title, path: `/jobs/${job.slug}` },
        ]}
        title={job.title}
        lead={`${where(job)} · ${job.industry}`}
      >
        <Badge tone="green">{job.employmentType}</Badge>
        {closed ? <Badge tone="error">Closed</Badge> : null}
      </PageHeader>

      <Section>
        <Container>
          <div className={styles.layout}>
            <div className={styles.main}>
              {job.verification === "unconfirmed" ? <DevNotice decision="D4">{job.verificationNote}</DevNotice> : null}
              {closed ? (
                <Alert tone="info" title="This position has closed">
                  <p>
                    It is no longer accepting applications. <Link href="/jobs">See current openings</Link>.
                  </p>
                </Alert>
              ) : null}

              <h2 className={styles.h2}>About the role</h2>
              <p className={styles.summary}>{job.summary}</p>

              <h2 className={styles.h2}>Fees</h2>
              <p>
                Every fee is quoted to you in writing before you pay. See <Link href="/pricing">Pricing &amp; fees</Link>, and{" "}
                <Link href="/verify">how to check you are dealing with Go Gulf</Link>.
              </p>
            </div>

            <aside className={styles.aside} aria-labelledby="job-facts-heading">
              <h2 id="job-facts-heading" className={styles.h3}>
                Job details
              </h2>
              <dl className={styles.facts}>
                {facts.map((f) => (
                  <div key={f.label} className={styles.fact}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </Container>
      </Section>

      {closed ? null : (
        <div className={styles.applyBar}>
          <div className={styles.applyInner}>
            <Button href={applyHref} icon="arrow-right" iconPosition="end">
              Apply for this job
            </Button>
            <Button href={askHref} variant="secondary" icon="whatsapp" opensWhatsApp>
              Ask on WhatsApp
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
