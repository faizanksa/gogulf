import styles from "./RouteGraphic.module.css";

/**
 * The one drawing on the site: routes from India to the Gulf. Geography reads the same
 * in every language — India sits east (right) of the Gulf — so it is never mirrored for
 * right-to-left pages. Decorative and text-free: it makes no claim (no count of
 * countries or cities), and screen readers skip it.
 */
export function RouteGraphic({ className }: { className?: string }) {
  const origin = { x: 452, y: 262 };
  const stops = [
    { x: 150, y: 132 },
    { x: 206, y: 188 },
    { x: 118, y: 214 },
    { x: 232, y: 118 },
  ];
  return (
    <svg viewBox="0 0 560 360" className={`${styles.graphic} ${className ?? ""}`} aria-hidden="true" focusable="false">
      {/* latitude lines */}
      <g className={styles.grid}>
        <path d="M20 300 C 180 250, 380 250, 540 300" />
        <path d="M20 230 C 180 180, 380 180, 540 230" />
        <path d="M20 160 C 180 110, 380 110, 540 160" />
        <path d="M20 90 C 180 40, 380 40, 540 90" />
      </g>
      {/* the Gulf, loosely */}
      <path className={styles.region} d="M86 250 C 70 196, 104 128, 170 96 C 228 70, 280 92, 286 142 C 292 196, 250 236, 196 250 C 150 262, 104 270, 86 250 Z" />
      {stops.map((s, i) => (
        <path
          key={i}
          className={styles.route}
          d={`M${origin.x} ${origin.y} C ${origin.x - 60} ${origin.y - 150 + i * 14}, ${s.x + 90} ${s.y - 90 + i * 10}, ${s.x} ${s.y}`}
        />
      ))}
      {stops.map((s, i) => (
        <circle key={i} className={styles.stop} cx={s.x} cy={s.y} r="5" />
      ))}
      <circle className={styles.originRing} cx={origin.x} cy={origin.y} r="18" />
      <circle className={styles.origin} cx={origin.x} cy={origin.y} r="8" />
    </svg>
  );
}
