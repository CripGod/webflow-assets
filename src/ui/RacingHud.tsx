/* ── v56: Racing HUD — one responsive 16:9 SVG ─────────────────────
   Recreates the simplified racing HUD to the layout spec: 1920×1080
   viewBox, exact panel bounding boxes, purple jelly palette, reusable
   panel/label systems, data-driven leaderboard/sectors/tyres, restrained
   glow and minimal animation. The night-drive backdrop is drawn in SVG
   (no photo, no canvas, no WebGL) so the whole screen stays one scalable
   vector asset. */

const C = {
  panelDark: "#120B20",
  purpleMain: "#A528E8",
  purpleLight: "#DB7BFF",
  magenta: "#FF45E6",
  white: "#F8F4FF",
  textMain: "#F3EAFE",
  textSecondary: "#C7B8D6",
  textMuted: "#8F809E",
  green: "#44FF69",
  red: "#FF477F",
  stroke: "#8734B3",
  strokeLight: "#E26AFF",
};

const LEADERBOARD = [
  { position: 1, driver: "NOR", gap: "01:21.548", selected: false },
  { position: 2, driver: "VER", gap: "+0.842", selected: false },
  { position: 3, driver: "YOU", gap: "+2.156", selected: true },
  { position: 4, driver: "LEC", gap: "+3.271", selected: false },
  { position: 5, driver: "PIA", gap: "+4.712", selected: false },
];

const SECTORS = [
  { id: "S1", time: "00:28.432", positive: true, tabX: 558, valX: 628 },
  { id: "S2", time: "00:27.891", positive: true, tabX: 822, valX: 892 },
  { id: "S3", time: "00:28.335", positive: false, tabX: 1092, valX: 1162 },
];

const TIRES = [
  { id: "FL", temperature: "93°C", wear: "92%", x: 1364, y: 798 },
  { id: "RL", temperature: "89°C", wear: "93%", x: 1364, y: 910 },
  { id: "FR", temperature: "95°C", wear: "90%", x: 1692, y: 798 },
  { id: "RR", temperature: "91°C", wear: "91%", x: 1692, y: 910 },
];

const OPPONENTS: [number, number][] = [
  [104, 404], [148, 344], [188, 374], [196, 452], [252, 476],
  [310, 432], [368, 326], [404, 376], [352, 470], [222, 560],
];

/* label helpers — one typographic system, all caps, Inter */
function Label({ x, y, size = 16, fill = C.textSecondary, weight = 700, anchor, spacing = 1.5, children }: {
  x: number; y: number; size?: number; fill?: string; weight?: number; anchor?: "middle" | "end"; spacing?: number; children: React.ReactNode;
}) {
  return <text x={x} y={y} fontSize={size} fontWeight={weight} fill={fill} letterSpacing={spacing} textAnchor={anchor}>{children}</text>;
}
function Big({ x, y, size, fill = C.white, anchor, italic, glow, children }: {
  x: number; y: number; size: number; fill?: string; anchor?: "middle" | "end"; italic?: boolean; glow?: boolean; children: React.ReactNode;
}) {
  return <text x={x} y={y} fontSize={size} fontWeight={700} fill={fill} letterSpacing={-1} textAnchor={anchor}
    fontStyle={italic ? "italic" : undefined} filter={glow ? "url(#rhActiveGlow)" : undefined}>{children}</text>;
}

/** The shared panel system: gradient body, inner outline, top highlight,
 *  one corner accent. Every rectangular panel reuses this. */
function Panel({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx={24} fill="url(#rhPanel)" stroke={C.stroke} strokeWidth={2} filter="url(#rhPanelGlow)" />
      <rect x={4} y={4} width={w - 8} height={h - 8} rx={20} fill="none" stroke="#D86AFF" strokeOpacity={0.26} strokeWidth={1} />
      <rect x={26} y={7} width={Math.min(w * 0.44, 260)} height={2.5} rx={1.25} fill="url(#rhTopHi)" />
      <polygon points="0,18 18,0 48,0 20,28" fill="url(#rhCorner)" transform="translate(18 12)" />
    </g>
  );
}

/* RPM arc — 18 trapezoid segments, 205°→335°, generated not hand-drawn */
function rpmSegments() {
  const cx = 910, cy = 778, rOut = 304, rIn = 262;
  const startAngle = 205, endAngle = 335, segmentCount = 18, gapDeg = 1.6;
  const active = 13;
  const segs = [];
  const step = (endAngle - startAngle) / segmentCount;
  const dir = (deg: number, r: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  for (let i = 0; i < segmentCount; i++) {
    const a0 = startAngle + i * step + gapDeg / 2;
    const a1 = startAngle + (i + 1) * step - gapDeg / 2;
    const [x1, y1] = dir(a0, rOut); const [x2, y2] = dir(a1, rOut);
    const [x3, y3] = dir(a1, rIn); const [x4, y4] = dir(a0, rIn);
    const color = i < 12 ? "#C12CF3" : i < 15 ? "#E83CF4" : C.red;
    const on = i < active;
    segs.push(
      <polygon key={i} points={`${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`}
        fill={color} opacity={on ? 1 : 0.3}
        className={on && i >= 11 ? "rh-soft" : undefined}
        filter={on && i >= 11 ? "url(#rhActiveGlow)" : undefined} />
    );
  }
  const ticks = [];
  for (let v = 0; v <= 16; v += 2) {
    const a = startAngle + (v / 16) * (endAngle - startAngle);
    const [tx, ty] = dir(a, rOut + 20);
    ticks.push(<text key={v} x={tx} y={ty + 5} fontSize={15} fontWeight={600} fill={C.textMuted} textAnchor="middle">{v}</text>);
  }
  return <>{segs}{ticks}</>;
}

/* pedal bars — 6 slightly-skewed segments, throttle green / brake red */
function pedalBar(x: number, active: number, color: string, lean: number) {
  const rows = [];
  for (let i = 0; i < 6; i++) {
    const y = 828 + i * 20;
    const on = 5 - i < active;
    rows.push(
      <polygon key={i}
        points={`${x + i * lean},${y} ${x + 84 + i * lean},${y - 3} ${x + 84 + i * lean},${y + 10} ${x + i * lean},${y + 13}`}
        fill={on ? color : "#3D1858"} opacity={on ? 0.95 : 0.5} />
    );
  }
  return rows;
}

/* tyre tile — 3 concentric circles + 6 ticks, label, temp, wear */
function TireTile({ t }: { t: (typeof TIRES)[number] }) {
  const cx = t.x + 40, cy = t.y + 47;
  return (
    <g>
      <rect x={t.x} y={t.y} width={160} height={94} rx={14} fill="#1A0F2C" stroke={C.stroke} strokeOpacity={0.55} strokeWidth={1.5} />
      {[27, 19, 10].map((r) => <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke={C.purpleLight} strokeOpacity={r === 27 ? 0.9 : 0.45} strokeWidth={r === 27 ? 3 : 1.5} />)}
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return <line key={i} x1={cx + Math.cos(a) * 12} y1={cy + Math.sin(a) * 12} x2={cx + Math.cos(a) * 17} y2={cy + Math.sin(a) * 17} stroke={C.purpleLight} strokeOpacity={0.6} strokeWidth={2} />;
      })}
      <Label x={t.x + 86} y={t.y + 32} size={15} fill={C.textSecondary}>{t.id}</Label>
      <text x={t.x + 86} y={t.y + 56} fontSize={18} fontWeight={700} fill={C.textMain}>{t.temperature}</text>
      <text x={t.x + 86} y={t.y + 78} fontSize={17} fontWeight={700} fill={C.green}>{t.wear}</text>
    </g>
  );
}

export function RacingHud() {
  return (
    <svg className="rh" viewBox="0 0 1920 1080" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg" fontFamily="Inter, Arial, sans-serif" role="img"
      aria-label="Racing HUD — Kazuri Ring at night" data-screen="racing-hud">
      <defs>
        <linearGradient id="rhSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B0618" />
          <stop offset="55%" stopColor="#1B0F33" />
          <stop offset="100%" stopColor="#2A1547" />
        </linearGradient>
        <linearGradient id="rhRoad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#241539" />
          <stop offset="100%" stopColor="#0C0716" />
        </linearGradient>
        <linearGradient id="rhOverlay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#03020A" stopOpacity="0.28" />
          <stop offset="52%" stopColor="#070414" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#030208" stopOpacity="0.54" />
        </linearGradient>
        <radialGradient id="rhVignette" cx="0.5" cy="0.46" r="0.85">
          <stop offset="0%" stopColor="#000000" stopOpacity="0" />
          <stop offset="78%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.4" />
        </radialGradient>
        <linearGradient id="rhPanel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#241232" stopOpacity="0.94" />
          <stop offset="45%" stopColor="#100A1A" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#090711" stopOpacity="0.96" />
        </linearGradient>
        <linearGradient id="rhTopHi" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.52" />
          <stop offset="30%" stopColor="#DD6EFF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#A72BD5" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rhSelRow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5B0E88" />
          <stop offset="48%" stopColor="#BD24F3" />
          <stop offset="100%" stopColor="#5C0F89" />
        </linearGradient>
        <linearGradient id="rhCorner" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="30%" stopColor="#F18FFF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#70218F" stopOpacity="0" />
        </linearGradient>
        <filter id="rhPanelGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feFlood floodColor="#BD35FF" floodOpacity="0.26" />
          <feComposite in2="blur" operator="in" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="rhActiveGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feFlood floodColor="#FF55F4" floodOpacity="0.5" />
          <feComposite in2="blur" operator="in" />
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* 1 · background — SVG night drive, no raster */}
      <g id="rh-background">
        <rect width="1920" height="1080" fill="url(#rhSky)" />
        <polygon points="0,540 320,470 640,505 980,455 1320,500 1620,462 1920,520 1920,1080 0,1080" fill="#160C28" />
        <polygon points="0,600 400,540 760,565 1100,528 1500,560 1920,545 1920,1080 0,1080" fill="#1E1136" opacity="0.8" />
        {/* the road, converging at the horizon */}
        <polygon points="700,1080 1220,1080 985,470 875,470" fill="url(#rhRoad)" />
        <polygon points="700,1080 760,1080 905,470 875,470" fill="#2E1A4C" opacity="0.6" />
        <polygon points="1160,1080 1220,1080 985,470 955,470" fill="#2E1A4C" opacity="0.6" />
        {/* trackside light streaks */}
        {[540, 620, 730, 860, 1010].map((y, i) => (
          <g key={y} opacity={0.5 - i * 0.06}>
            <rect x={620 - i * 90} y={y} width={150 + i * 40} height={4 + i * 2} rx={3} fill="#B44BFF" opacity="0.35" />
            <rect x={1160 + i * 52} y={y} width={150 + i * 40} height={4 + i * 2} rx={3} fill="#B44BFF" opacity="0.35" />
          </g>
        ))}
        {/* horizon haze — wide and low so it never reads as a figure */}
        <ellipse cx="930" cy="466" rx="240" ry="44" fill="#C05CFF" opacity="0.09" />
      </g>

      {/* 2 · global readability overlay + vignette */}
      <g id="rh-overlay">
        <rect width="1920" height="1080" fill="url(#rhOverlay)" />
        <rect width="1920" height="1080" fill="url(#rhVignette)" />
      </g>

      {/* 3 · navigation chevrons on the road */}
      <g id="rh-navigation" className="rh-chev">
        {Array.from({ length: 10 }, (_, i) => {
          const t = i / 9;
          const y = 486 + t * 164;
          const w = 36 + t * 34, h = 12 + t * 8;
          return <polygon key={i} points={`${930 - w / 2},${y} ${930},${y + h} ${930 + w / 2},${y}`} fill="#BD35FF" opacity={0.65 - t * 0.25} />;
        })}
      </g>

      {/* 4-6 · panels */}
      <g id="rh-panels">
        <Panel x={32} y={32} w={450} h={180} />
        <Panel x={520} y={32} w={850} h={190} />
        <Panel x={1406} y={32} w={482} h={286} />
        <Panel x={32} y={244} w={430} h={430} />
        <Panel x={1330} y={454} w={558} h={248} />
        <Panel x={1330} y={726} w={558} h={300} />
        {/* speed cluster — shaped cockpit display, not a plain rect */}
        <path d="M 570 572 H 1250 C 1286 572, 1304 598, 1312 632 L 1336 748 C 1344 788, 1332 842, 1308 886 L 1262 970 C 1246 1002, 1212 1020, 1174 1020 H 646 C 608 1020, 574 1002, 558 970 L 512 886 C 488 842, 476 788, 484 748 L 508 632 C 516 598, 534 572, 570 572 Z"
          fill="url(#rhPanel)" stroke={C.stroke} strokeWidth={3} filter="url(#rhPanelGlow)" />
        <polygon points="0,18 18,0 48,0 20,28" fill="url(#rhCorner)" transform="translate(586 588)" />
      </g>

      {/* 7 · content */}
      <g id="rh-content">
        {/* A · position & lap */}
        <Label x={66} y={76} size={18}>POSITION</Label>
        <Big x={66} y={150} size={72} italic glow>P3</Big>
        <text x={186} y={150} fontSize={30} fontWeight={600} fill={C.textMuted}>/20</text>
        <line x1={260} y1={58} x2={260} y2={186} stroke={C.stroke} strokeOpacity={0.5} strokeWidth={1.5} />
        <Label x={302} y={76} size={18}>LAP</Label>
        <Big x={302} y={150} size={72} italic>12</Big>
        <text x={406} y={150} fontSize={30} fontWeight={600} fill={C.textMuted}>/20</text>

        {/* B · timing */}
        <Label x={675} y={74} anchor="middle">CURRENT LAP</Label>
        <Big x={675} y={126} size={34} anchor="middle">01:24.658</Big>
        <line x1={806} y1={58} x2={806} y2={156} stroke={C.stroke} strokeOpacity={0.5} strokeWidth={1.5} />
        <Label x={945} y={74} anchor="middle">BEST LAP</Label>
        <Big x={945} y={126} size={34} anchor="middle" fill="#D94BFF">01:22.934</Big>
        <line x1={1084} y1={58} x2={1084} y2={156} stroke={C.stroke} strokeOpacity={0.5} strokeWidth={1.5} />
        <Label x={1215} y={74} anchor="middle">DELTA</Label>
        <Big x={1215} y={126} size={36} anchor="middle" fill={C.green} glow>-0.724</Big>
        <line x1={520} y1={154} x2={1370} y2={154} stroke={C.stroke} strokeOpacity={0.4} strokeWidth={1} />
        {SECTORS.map((s) => (
          <g key={s.id}>
            <rect x={s.tabX} y={169} width={56} height={30} rx={10} fill="#2A1440" stroke={C.stroke} strokeOpacity={0.7} strokeWidth={1.5} />
            <text x={s.tabX + 28} y={189} fontSize={15} fontWeight={700} fill={C.purpleLight} textAnchor="middle" letterSpacing={1}>{s.id}</text>
            <text x={s.valX} y={191} fontSize={19} fontWeight={600} fill={s.positive ? C.green : C.textSecondary}>{s.time}</text>
          </g>
        ))}

        {/* C · leaderboard */}
        <Label x={1444} y={72} size={18} fill={C.textMain}>TOP 5</Label>
        {LEADERBOARD.map((r, i) => {
          const y = 92 + i * 44;
          return (
            <g key={r.position}>
              {r.selected && <rect x={1426} y={y - 4} width={442} height={44} rx={8} fill="url(#rhSelRow)" filter="url(#rhActiveGlow)" className="rh-soft" />}
              <text x={1462} y={y + 24} fontSize={19} fontWeight={700} fill={r.selected ? C.white : C.textMuted}>{r.position}</text>
              <text x={1530} y={y + 24} fontSize={19} fontWeight={700} fill={r.selected ? C.white : C.textMain} letterSpacing={1.5}>{r.driver}</text>
              <text x={1840} y={y + 24} fontSize={18} fontWeight={600} fill={r.selected ? C.white : C.textSecondary} textAnchor="end">{r.gap}</text>
            </g>
          );
        })}

        {/* D · track map — Kazuri Ring */}
        <Label x={70} y={282} size={18} fill={C.textMain}>TRACK MAP</Label>
        <Label x={424} y={282} size={13} fill={C.textMuted} anchor="end" spacing={2}>KAZURI RING</Label>
        <path d="M 104 404 C 118 336, 172 336, 188 374 C 200 406, 170 430, 194 454 C 224 484, 282 470, 310 432 C 342 390, 350 328, 392 318 C 426 310, 424 348, 404 380 C 382 420, 354 470, 326 518 C 300 560, 260 586, 216 562 C 176 540, 150 494, 104 470 C 74 452, 78 424, 104 404"
          fill="none" stroke="#C348F4" strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
        <path d="M 104 404 C 118 336, 172 336, 188 374 C 200 406, 170 430, 194 454 C 224 484, 282 470, 310 432 C 342 390, 350 328, 392 318 C 426 310, 424 348, 404 380 C 382 420, 354 470, 326 518 C 300 560, 260 586, 216 562 C 176 540, 150 494, 104 470 C 74 452, 78 424, 104 404"
          fill="none" stroke="#F29BFF" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        {OPPONENTS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={5} fill="#F9F2FF" />)}
        <g filter="url(#rhActiveGlow)">
          <circle cx={294} cy={526} r={18} fill="url(#rhSelRow)" stroke={C.strokeLight} strokeWidth={2} />
          <polygon points="294,516 288,528 300,528" fill={C.white} />
        </g>
        <line x1={54} y1={566} x2={440} y2={566} stroke={C.stroke} strokeOpacity={0.5} strokeWidth={1.5} />
        <Label x={70} y={596} size={14}>NEXT TURN</Label>
        <text x={70} y={640} fontSize={28} fontWeight={700} fill={C.textMain} letterSpacing={1}>RIGHT 5</text>
        <path d="M 214 630 h 26 v -14 l 22 20 -22 20 v -14 h -34 v -12 Z" fill={C.purpleLight} opacity={0.9} />
        <text x={278} y={640} fontSize={24} fontWeight={600} fill={C.textSecondary}>98m</text>

        {/* E · power & energy */}
        <Label x={1374} y={494} size={18} fill={C.textMain}>POWER &amp; ENERGY</Label>
        <line x1={1518} y1={516} x2={1518} y2={674} stroke={C.stroke} strokeOpacity={0.5} strokeWidth={1.5} />
        <line x1={1692} y1={516} x2={1692} y2={674} stroke={C.stroke} strokeOpacity={0.5} strokeWidth={1.5} />
        <Label x={1418} y={540} size={16}>FUEL</Label>
        <Big x={1418} y={592} size={34}>23.4 L</Big>
        <Label x={1418} y={636} size={14} fill={C.textMuted}>LAPS LEFT</Label>
        <text x={1418} y={674} fontSize={28} fontWeight={700} fill={C.textSecondary}>8.7</text>
        <Label x={1604} y={540} size={16}>ERS</Label>
        <polygon points="1578,558 1560,584 1572,584 1568,602 1588,574 1575,574 1582,558" fill={C.green} filter="url(#rhActiveGlow)" />
        <Big x={1634} y={592} size={34} fill={C.green}>4 / 4</Big>
        <Label x={1604} y={654} size={17} anchor="middle" fill={C.purpleLight}>OVERTAKE MODE</Label>
        <Label x={1768} y={540} size={16}>BATTERY</Label>
        <Big x={1782} y={592} size={34}>78%</Big>
        <Label x={1744} y={636} size={14} fill={C.textMuted}>TEMP</Label>
        <text x={1838} y={636} fontSize={16} fontWeight={600} fill={C.textSecondary} textAnchor="end">52°C</text>
        <rect x={1732} y={658} width={112} height={8} rx={4} fill="#2A1440" />
        <rect x={1732} y={658} width={87} height={8} rx={4} fill={C.green} opacity={0.9} />

        {/* F · tyre status */}
        <Label x={1374} y={766} size={18} fill={C.textMain}>TYRE STATUS</Label>
        <g stroke={C.purpleLight} strokeOpacity={0.85} strokeWidth={2.5} fill="#1A0F2C">
          <rect x={1583} y={800} width={50} height={140} rx={22} />
          {[[1565, 806], [1618, 806], [1565, 902], [1618, 902]].map(([x, y]) => (
            <rect key={`${x}${y}`} x={x} y={y} width={14} height={32} rx={5} fill="#2A1440" />
          ))}
          <ellipse cx={1608} cy={856} rx={13} ry={22} fill="#120B20" />
        </g>
        {TIRES.map((t) => <TireTile key={t.id} t={t} />)}

        {/* G · speed cluster */}
        {rpmSegments()}
        <Label x={910} y={708} size={15} anchor="middle" fill={C.textMuted} spacing={2}>RPM x1000</Label>
        <Big x={910} y={828} size={96} anchor="middle" italic glow>6</Big>
        <Big x={910} y={930} size={76} anchor="middle" italic>248</Big>
        <text x={1020} y={930} fontSize={22} fontWeight={600} fill={C.textSecondary} letterSpacing={2}>KPH</text>
        <Label x={548} y={806} size={16}>THROTTLE</Label>
        {pedalBar(548, 4, C.green, 3)}
        <text x={590} y={968} fontSize={26} fontWeight={700} fill={C.green} textAnchor="middle">62%</text>
        <Label x={1228} y={806} size={16}>BRAKE</Label>
        {pedalBar(1190, 1, C.red, -3)}
        <text x={1230} y={968} fontSize={26} fontWeight={700} fill={C.red} textAnchor="middle">8%</text>
      </g>
    </svg>
  );
}
