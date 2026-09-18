// Shared by the full-size post and the LOOKS thumbnail, so the picker cannot
// silently keep an obsolete bolt when the board art changes.
export function boltArt(seat: number, id: string, tip = 5): string {
  const threads = Array.from({ length: Math.ceil((seat - tip) / 5) }, (_, i) => {
    const y = tip + i * 5
    return `<path d="M21 ${y + 3}Q32 ${y + 6} 43 ${y - 1}" fill="none" stroke="#425B6A" stroke-width="1.8" opacity=".65"/>` +
      `<path d="M21 ${y + 1.4}Q32 ${y + 4.4} 43 ${y - 2.6}" fill="none" stroke="#EFF5F7" stroke-width="1.25" opacity=".78"/>`
  }).join('')
  return `<defs>
    <linearGradient id="${id}-metal">
      <stop offset="0" stop-color="#657782"/><stop offset=".24" stop-color="#E6EFF2"/>
      <stop offset=".44" stop-color="#ABBBC4"/><stop offset=".7" stop-color="#7B909E"/>
      <stop offset="1" stop-color="#465B68"/>
    </linearGradient>
    <clipPath id="${id}-shaft"><path d="M22 ${tip}Q32 ${tip - 6} 42 ${tip}V${seat}Q32 ${seat + 5} 22 ${seat}Z"/></clipPath>
  </defs>
  <ellipse cx="32" cy="${seat + 14}" rx="32" ry="8" fill="#253D49" opacity=".14"/>
  <g class="bolt-head">
    <path d="M0 ${seat}L16 ${seat + 10}H48L64 ${seat}V${seat + 7}L48 ${seat + 17}H16L0 ${seat + 7}Z" fill="#768C99" stroke="#536A78" stroke-width=".8"/>
    <path d="M16 ${seat + 10}H48V${seat + 17}H16Z" fill="#9EAEB6"/>
    <path d="M48 ${seat + 10}L64 ${seat}V${seat + 7}L48 ${seat + 17}Z" fill="#526A78"/>
    <path d="M0 ${seat}L16 ${seat - 10}H48L64 ${seat}L48 ${seat + 10}H16Z" fill="#D3DEE3" stroke="#6D8491" stroke-width=".8" stroke-linejoin="round"/>
    <path d="M2 ${seat}L17 ${seat - 8.5}H47" fill="none" stroke="#F4F8FA" stroke-width="1.5" stroke-linecap="round"/>
  </g>
  <g class="bolt-shaft" clip-path="url(#${id}-shaft)">
    <rect x="22" width="20" height="${seat + 5}" fill="url(#${id}-metal)"/>${threads}
  </g>
  <ellipse class="bolt-tip" cx="32" cy="${tip}" rx="10" ry="3.3" fill="#E5EEF2" stroke="#738996" stroke-width="1"/>`
}
