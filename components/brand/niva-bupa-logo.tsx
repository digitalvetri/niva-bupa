// Niva Bupa logo — recreated as an inline SVG (brand approximation). To use the official asset
// instead, drop it at public/niva-bupa.png and replace this component's <svg> with
// <img src="/niva-bupa.png" alt="Niva Bupa Health Insurance" className={className} />.
export function NivaBupaLogo({ className }: { className?: string }) {
  const BLUE = "#4CA6DD";
  const ORANGE = "#F5A623";
  return (
    <svg viewBox="0 0 200 82" className={className} role="img" aria-label="Niva Bupa Health Insurance" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* "niva" wordmark */}
      <text x="0" y="52" fontFamily="'Nunito','Poppins',ui-rounded,'Segoe UI',system-ui,sans-serif" fontWeight={800} fontSize={48} letterSpacing={-1.5} fill={BLUE}>
        niva
      </text>
      {/* orange ring dot over the "i" */}
      <circle cx="52" cy="15" r="6.2" stroke={ORANGE} strokeWidth={4.2} />

      {/* Bupa box with heartbeat pulse */}
      <g transform="translate(126,2)">
        <rect width="72" height="42" rx="1.5" fill={BLUE} />
        <text x="9" y="27" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fontWeight={700} fontSize={21} fill="#ffffff">
          Bupa
        </text>
        <path d="M8 33 h7 l2.5 -9 3.5 16 3 -8 2.5 4 h33" stroke="#ffffff" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
      </g>

      {/* Health Insurance */}
      <text x="30" y="74" fontFamily="'Nunito','Poppins',ui-rounded,'Segoe UI',system-ui,sans-serif" fontWeight={600} fontSize={15} letterSpacing={1.5} fill={BLUE}>
        Health Insurance
      </text>
    </svg>
  );
}
