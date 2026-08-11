// Renders a JSON-LD <script> tag. Escapes "<" so page data can never break out
// of the script context (see: https://nextjs.org/docs/app/guides/json-ld).
export default function JsonLd({ data }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
