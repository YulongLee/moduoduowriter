import React from 'react';

export function Brand({ small = false }) {
 return <img className="brand-mark" src="/brand-mark.svg?v=3" width={small?26:36} height={small?26:36} alt="" aria-hidden="true" draggable={false}/>;
}

export function HeroArt() {
 return <svg className="hero-art" viewBox="0 0 440 280" fill="none" aria-hidden="true">
  <defs><linearGradient id="page" x1="161" y1="114" x2="280" y2="246" gradientUnits="userSpaceOnUse"><stop stopColor="#fffef6"/><stop offset="1" stopColor="#e9e7d6"/></linearGradient><linearGradient id="back" x1="313" y1="101" x2="300" y2="242" gradientUnits="userSpaceOnUse"><stop stopColor="#7eaa8f"/><stop offset="1" stopColor="#37654f"/></linearGradient></defs>
  <circle cx="259" cy="136" r="108" fill="#d6e5d7" opacity=".65"/>
  <path d="M138 226C165 215 335 214 372 232C385 239 336 253 270 254C185 254 111 238 138 226Z" fill="#9db99f" opacity=".2"/>
  <path d="M128 191L266 172L357 198L217 222L128 203Z" fill="#476f5c"/><path d="M128 188L267 169L356 194L215 215Z" fill="#90ad91"/><path d="M134 195L215 220L350 198V210L215 234L134 209Z" fill="#f8f5e8"/><path d="M215 221L346 201M215 225L346 205M215 229L346 209" stroke="#d2d4c4" strokeWidth="1"/><path d="M128 207L214 233L357 208V215L214 241L128 215Z" fill="#456b58"/>
  <path d="M130 166L267 147L346 173L207 196L130 178Z" fill="#c3a67e"/><path d="M135 169L208 191L340 170V184L208 208L135 185Z" fill="#fffaf0"/><path d="M210 196L335 175M210 201L335 180" stroke="#d9cfb9"/><path d="M130 182L207 205L346 182V188L207 213L130 189Z" fill="#c3a67e"/>
  <path d="M163 147L224 158L319 137L346 159L224 183L146 160Z" fill="#315d47"/>
  <path d="M224 156C240 121 275 115 313 110L341 151C296 151 263 156 224 176Z" fill="url(#page)"/>
  <path d="M224 156C206 128 183 119 150 121L151 155C180 155 203 164 224 176Z" fill="#fffcf0"/>
  <path d="M224 156v20M232 155C256 141 287 135 315 135M236 149C260 135 283 131 310 129M241 143C260 132 284 126 306 124M217 154C202 142 183 135 163 134M215 160C199 149 183 143 164 142" stroke="#c1c6af" strokeLinecap="round"/>
  <path d="M224 176L222 198L237 190L247 192L244 168" fill="#d9a375"/>
  <path d="M302 110L309 53L351 61L345 142C329 130 315 129 302 132Z" fill="url(#back)"/><path d="M307 61L312 62M347 69L340 126" stroke="#d3e4cc" strokeLinecap="round"/><path d="M313 73L339 78M312 80L333 84M311 87L335 92" stroke="#c2d3b5" strokeWidth="1.2"/>
  <path d="M295 179L343 77L350 73L351 82L306 184L294 197L295 179Z" fill="#e7b271"/><path d="M298 180L343 81L347 83L303 183" fill="#f9d197"/><path d="M294 197L296 185L302 188Z" fill="#395643"/>
  <path d="M356 176C354 144 363 118 386 96M366 131C351 122 351 109 356 99C369 106 373 119 366 131ZM372 116C372 100 381 93 392 92C391 106 383 114 372 116ZM360 149C343 147 338 138 337 127C352 130 360 138 360 149Z" fill="#8ba88a"/>
  <path d="M99 120C115 127 126 122 131 110M116 121L111 102" stroke="#537c61" strokeWidth="2" strokeLinecap="round"/><path d="M109 99C93 84 102 75 110 80C117 84 115 94 109 99ZM113 105C124 88 133 92 132 99C131 106 121 108 113 105Z" fill="#9ab797"/>
  <path d="M270 52v12M264 58h12M142 78v10M137 83h10M386 178v8M382 182h8" stroke="#8fac8c" strokeWidth="1.5" strokeLinecap="round"/>
  <circle cx="177" cy="64" r="3" fill="#b3c7a9"/><circle cx="378" cy="63" r="2" fill="#9eb798"/>
  <path d="M189 93C202 71 225 70 237 78" stroke="#97b193" strokeDasharray="3 5" strokeLinecap="round"/>
 </svg>
}

export function BookCover({ work, large = false }) {
 const illustrated=['fog','spring','orbit'].includes(work.cover);
 return <div className={`book-cover cover-${work.cover || 'plain'} ${large ? 'large' : ''} ${illustrated?'illustrated-cover':''}`}>
   <div className="book-cover-art"/><div className="book-spine"/>
   {!illustrated&&<div className="plain-ornament">墨</div>}
   <span className="cover-kicker">墨 多 多 · 故 事 集</span>
   <strong>{work.title}</strong><span className="cover-subtitle">{work.subtitle || 'A STORY TO BE TOLD'}</span>
 </div>;
}
