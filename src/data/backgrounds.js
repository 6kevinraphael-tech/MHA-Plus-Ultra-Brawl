/** Arena definitions using uploaded background images */
export const ARENAS = [
  {
    id: 'ua-entrance',
    name: 'U.A. Entrance',
    show: 'MHA',
    imageKey: 'bg-ua-entrance',
    musicTag: 'hero',
    particles: { type: 'leaves', color: 0xf48fb1, accent: 0xfce4ec, rate: 2200 },
    parallaxTint: 0x1a237e,
  },
  {
    id: 'ua-campus',
    name: 'U.A. Campus',
    show: 'MHA',
    imageKey: 'bg-ua-campus',
    musicTag: 'hero',
    particles: { type: 'leaves', color: 0x8bc34a, accent: 0xaed581, rate: 2400 },
    parallaxTint: 0x0d47a1,
  },
  {
    id: 'city-streets',
    name: 'Musutafu Streets',
    show: 'MHA',
    imageKey: 'bg-city-streets',
    musicTag: 'battle',
    particles: { type: 'dust', color: 0xb0bec5, accent: 0xeceff1, rate: 2600 },
    parallaxTint: 0x263238,
  },
  {
    id: 'dojo',
    name: 'Ancient Dojo',
    show: 'MHA',
    imageKey: 'bg-dojo',
    musicTag: 'hero',
    particles: { type: 'leaves', color: 0x66bb6a, accent: 0xa5d6a7, rate: 2000 },
    parallaxTint: 0x1b5e20,
  },
  {
    id: 'ground-beta',
    name: 'Ground Beta',
    show: 'MHA',
    imageKey: 'bg-ground-beta',
    musicTag: 'battle',
    particles: { type: 'dust', color: 0x9e9e9e, accent: 0xbdbdbd, rate: 2400 },
    parallaxTint: 0x212121,
  },
  {
    id: 'forest-camp',
    name: 'Forest Training Camp',
    show: 'MHA',
    imageKey: 'bg-forest-camp',
    musicTag: 'hero',
    particles: { type: 'leaves', color: 0x43a047, accent: 0x81c784, rate: 2100 },
    parallaxTint: 0x1b4332,
  },
];

/** Legacy stage ids from older builds — map to the new arena set. */
const LEGACY_STAGE_IDS = {
  'ua-high': 'ua-entrance',
  'blue-flames': 'city-streets',
  ruins: 'ground-beta',
};

export function pickRandomArena() {
  return ARENAS[Math.floor(Math.random() * ARENAS.length)];
}

export function getArenaById(id) {
  const resolved = LEGACY_STAGE_IDS[id] ?? id;
  return ARENAS.find((a) => a.id === resolved) ?? ARENAS[0];
}
