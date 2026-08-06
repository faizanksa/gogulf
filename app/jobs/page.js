import JobsBoard from "@/components/JobsBoard";

export const metadata = {
  title: "Jobs Available",
  description:
    "Current open positions across Saudi Arabia, UAE, Qatar, Oman, Kuwait and Bahrain. Apply directly online.",
};

export default function JobsPage() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="eyebrow" style={{ color: "var(--gold)" }}>Jobs Available</div>
          <h1>Current openings across the Gulf</h1>
          <p>Every role below is genuine and verified. Click Apply Now, fill the short form, and our team follows up directly.</p>
        </div>
      </section>

      <section>
        <div className="container">
          <JobsBoard />
        </div>
      </section>
    </>
  );
}
