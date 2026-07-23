// Niva Bupa logo — faithful inline-SVG recreation of the official mark (bright niva cyan + orange
// ring over the "i", cyan Bupa box with white ECG pulse, "Health Insurance" beneath). Inline SVG so
// it renders crisply everywhere including html-to-image PNG exports (an external raster can taint the
// export canvas). To use the exact raster instead, drop it at public/niva-bupa.png and swap the <svg>
// for <img src="/niva-bupa.png" alt="Niva Bupa Health Insurance" className={className} />.
export function NivaBupaLogo({ className }: { className?: string }) {
  const CYAN = "#00A9E0";
  const ORANGE = "#F7A81B";
  return (
    <svg viewBox="0 0 210 84" className={className} role="img" aria-label="Niva Bupa Health Insurance" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* "niva" wordmark — rounded, bold */}
      <text x="0" y="53" fontFamily="'Nunito','Poppins',ui-rounded,'Segoe UI',system-ui,sans-serif" fontWeight={800} fontSize={50} letterSpacing={-2} fill={CYAN}>
        niva
      </text>
      {/* orange ring over the "i" (hollow donut) */}
      <circle cx="53.5" cy="14" r="6.6" stroke={ORANGE} strokeWidth={4.6} />

      {/* Bupa box with heartbeat pulse */}
      <g transform="translate(132,1)">
        <rect width="78" height="44" rx="1" fill={CYAN} />
        <text x="10" y="29" fontFamily="'Trebuchet MS','Segoe UI',system-ui,sans-serif" fontStyle="italic" fontWeight={700} fontSize={22} fill="#ffffff">
          Bupa
        </text>
        {/* ECG: flat → small dip → tall spike → drop → recover → flat */}
        <path d="M6 34 h8 l2 -3 2.5 -13 3 24 2.5 -12 2 4 h33" stroke="#ffffff" strokeWidth={2.8} strokeLinejoin="round" strokeLinecap="round" />
      </g>

      {/* Health Insurance */}
      <text x="30" y="76" fontFamily="'Nunito','Poppins',ui-rounded,'Segoe UI',system-ui,sans-serif" fontWeight={600} fontSize={15.5} letterSpacing={2} fill={CYAN}>
        Health Insurance
      </text>
    </svg>
  );
}
