import React from 'react';

const paperShadow={filter:'drop-shadow(0 3px 3px rgba(42,62,51,.07))'};

function Ideas(){return <g>
  <ellipse cx="132" cy="104" rx="77" ry="7" fill="#BEA473" opacity=".09"/>
  <g transform="rotate(8 163 67)" style={paperShadow}><rect x="127" y="35" width="75" height="64" rx="7" fill="#FBF3E5" stroke="#E9DABF"/><path d="M142 54H182M142 63H188M142 72H174" stroke="#D8C7AA" strokeWidth="2" strokeLinecap="round"/><path d="m178 85 4 4 8-10" fill="none" stroke="#B98D48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></g>
  <g transform="rotate(-8 110 62)" style={paperShadow}><rect x="65" y="22" width="90" height="76" rx="7" fill="#FFFEFB" stroke="#E8DFCF"/><rect x="80" y="37" width="29" height="5" rx="2.5" fill="#DEC795"/><path d="M80 53H138M80 62H130M80 71H137M80 80H118" stroke="#D9D9CD" strokeWidth="2" strokeLinecap="round"/><path d="M95 17v12M102 15v12" stroke="#C2A46D" strokeWidth="2.5" strokeLinecap="round"/></g>
  <path d="m179 13 2.8 8.2L190 24l-8.2 2.8L179 35l-2.8-8.2L168 24l8.2-2.8Z" fill="#D9B773" stroke="#C5A15E" strokeWidth=".7"/>
  <path d="m52 40 1.8 5.2L59 47l-5.2 1.8L52 54l-1.8-5.2L45 47l5.2-1.8Z" fill="#D7C096" opacity=".8"/>
  <circle cx="207" cy="75" r="2.2" fill="#C9AF7C"/>
</g>;}

function Outline(){return <g>
  <ellipse cx="130" cy="105" rx="82" ry="6" fill="#8A9BAD" opacity=".08"/>
  <g transform="rotate(-3 130 62)" style={paperShadow}><rect x="48" y="15" width="164" height="87" rx="8" fill="#FDFEFE" stroke="#DCE4EB"/><path d="M48 29H212" stroke="#E8EDF1"/><circle cx="59" cy="22" r="1.5" fill="#B4C3D1"/><circle cx="65" cy="22" r="1.5" fill="#D1DBE4"/><circle cx="71" cy="22" r="1.5" fill="#D1DBE4"/>
    <rect x="102" y="39" width="57" height="16" rx="4" fill="#718CA7"/><path d="M113 47H147" stroke="#F6F9FC" strokeWidth="2" strokeLinecap="round"/>
    <path d="M130 55v10M80 71v-6h101v6M130 65v6" fill="none" stroke="#9CB0C4" strokeWidth="1.5" strokeLinejoin="round"/>
    <rect x="63" y="73" width="35" height="17" rx="4" fill="#EDF2F7" stroke="#D4DFEA"/><rect x="113" y="73" width="35" height="17" rx="4" fill="#EDF2F7" stroke="#D4DFEA"/><rect x="163" y="73" width="35" height="17" rx="4" fill="#EDF2F7" stroke="#D4DFEA"/>
    <path d="M72 81.5H88M122 81.5H139M172 81.5H189" stroke="#94A9BF" strokeWidth="1.8" strokeLinecap="round"/>
  </g>
  <path d="m218 44 2 5.5 5.5 2-5.5 2-2 5.5-2-5.5-5.5-2 5.5-2Z" fill="#A3B7CA" opacity=".6"/>
</g>;}

function Character(){return <g>
  <ellipse cx="132" cy="107" rx="80" ry="6" fill="#789987" opacity=".08"/>
  <path d="M81 65h23M159 65h25" stroke="#9FBDAA" strokeWidth="1.6" strokeDasharray="3 4"/>
  <g transform="rotate(-8 75 69)" style={paperShadow}><rect x="48" y="39" width="49" height="59" rx="6" fill="#F1F6F0" stroke="#DCE7DA"/><circle cx="72.5" cy="57" r="7" fill="#C4D3BD"/><path d="M59 76c0-7 5.5-11 13.5-11S86 69 86 76" fill="#C4D3BD"/><path d="M61 85H84" stroke="#AFC2AC" strokeWidth="2" strokeLinecap="round"/></g>
  <g transform="rotate(8 187 70)" style={paperShadow}><rect x="166" y="41" width="47" height="57" rx="6" fill="#F0F5F2" stroke="#D8E5DC"/><circle cx="189.5" cy="58" r="7" fill="#BACFC5"/><path d="M177 77c0-7 4.5-11 12.5-11S202 70 202 77" fill="#BACFC5"/><path d="M179 86H200" stroke="#AAC2B6" strokeWidth="2" strokeLinecap="round"/></g>
  <g style={paperShadow}><rect x="101" y="15" width="62" height="91" rx="7" fill="#FEFFFC" stroke="#D5E2D6"/><rect x="115" y="23" width="34" height="4" rx="2" fill="#CFDFCE"/><circle cx="132" cy="45" r="10" fill="#7F9D86"/><path d="M114 69c0-10 7-16 18-16s18 6 18 16" fill="#7F9D86"/><path d="M114 81H150M119 89H145M123 97H141" stroke="#CFDBCD" strokeWidth="2" strokeLinecap="round"/></g>
  <circle cx="209" cy="29" r="3" fill="#C0D3C3"/>
</g>;}

function Continue(){return <g>
  <ellipse cx="131" cy="104" rx="82" ry="7" fill="#8B83A0" opacity=".08"/>
  <g transform="rotate(-5 122 64)" style={paperShadow}><path d="M49 30c26-9 51-8 74 0 24-8 49-9 75 0v65c-26-7-51-6-75 2-23-8-48-9-74-2Z" fill="#EAE6F0" stroke="#D8D3E1"/><path d="M51 25c25-8 48-7 72 1 24-8 48-9 73-1v64c-25-7-49-6-73 2-24-8-47-9-72-2Z" fill="#FFFEFC" stroke="#DED9E5"/><path d="M123 26v65" stroke="#DCD6E5"/><path d="M63 40c17-3 32-2 47 2M63 50c17-3 32-2 47 2M63 60c17-3 32-2 47 2M63 70c17-3 32-2 47 2M137 41c15-3 30-4 46-2M137 51c15-3 30-4 46-2M137 61c10-2 19-3 28-3" stroke="#D9D5DE" strokeWidth="1.8" strokeLinecap="round"/><path d="M137 72h24" stroke="#A99DBB" strokeWidth="2.4" strokeLinecap="round"/><path d="m166 69 4 3-4 3" stroke="#A99DBB" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </g>
  <g transform="rotate(31 191 54)" style={paperShadow}><rect x="187" y="12" width="8" height="66" rx="3" fill="#776B8D"/><path d="M187 30h8M187 35h8" stroke="#C9C1D5" strokeWidth="1.3"/><path d="m187 78 4 12 4-12" fill="#C6B7A4"/><path d="m189.8 86.5 1.2 3.5 1.2-3.5" fill="#4D435F"/><path d="M193 19v16" stroke="#DDD6E5" strokeWidth="1.2" strokeLinecap="round"/></g>
</g>;}

function Polish(){return <g>
  <ellipse cx="133" cy="105" rx="79" ry="6" fill="#6F9D94" opacity=".08"/>
  <g transform="rotate(-8 98 65)" style={paperShadow}><rect x="57" y="23" width="76" height="76" rx="6" fill="#F8FAF7" stroke="#DAE4DF"/><path d="M70 38h46M70 48h41M70 58h47M70 68h33M70 78h42" stroke="#CFD9D4" strokeWidth="2" strokeLinecap="round"/><path d="M78 48h27M75 68h21" stroke="#C69D89" strokeWidth="1.5" strokeLinecap="round"/><path d="m112 60 3 3 5-7" fill="none" stroke="#8CAFA2" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></g>
  <g transform="rotate(5 159 63)" style={paperShadow}><rect x="119" y="16" width="80" height="87" rx="6" fill="#FEFFFC" stroke="#D1E1DA"/><rect x="133" y="29" width="34" height="5" rx="2.5" fill="#8CB6A4"/><path d="M133 46h52M133 56h45M133 66h50M133 76h36M133 86h43" stroke="#C5D5CE" strokeWidth="2" strokeLinecap="round"/><path d="M133 59h25M148 79h20" stroke="#5A9681" strokeWidth="1.5" strokeLinecap="round"/></g>
  <circle cx="202" cy="84" r="13" fill="#E3F0E7" stroke="#C8DDCF"/><path d="m196.5 84 3.5 3.5 7-7.5" fill="none" stroke="#58836B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
</g>;}

const scenes={ideas:Ideas,outline:Outline,character:Character,continue:Continue,polish:Polish};
export function HomeFeatureArtwork({feature}){
  const Scene=scenes[feature]||Ideas;
  return <svg className="home-feature-scene" viewBox="0 0 260 120" aria-hidden="true" focusable="false"><Scene/></svg>;
}
