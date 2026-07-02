/** Arena definitions using uploaded background images */
export const ARENAS = [
  {
    id: 'ua-high',
    name: 'U.A. High School',
    show: 'MHA',
    imageKey: 'bg-mha-ua-high',
    musicTag: 'hero',
    particles: { type: 'leaves', color: 0x8bc34a, accent: 0xaed581, rate: 2200 },
    parallaxTint: 0x1a237e,
  },
  {
    id: 'blue-flames',
    name: 'Blue Flames District',
    show: 'MHA',
    imageKey: 'bg-mha-blue-flames',
    musicTag: 'villain',
    particles: { type: 'embers', color: 0x38bdf8, accent: 0x7dd3fc, rate: 1800 },
    parallaxTint: 0x0c1633,
  },
  {
    id: 'ruins',
    name: 'Destroyed City',
    show: 'MHA',
    imageKey: 'bg-mha-ruins',
    musicTag: 'battle',
    particles: { type: 'dust', color: 0x9e9e9e, accent: 0xbdbdbd, rate: 2400 },
    parallaxTint: 0x212121,
  },
];

export function pickRandomArena() {
  return ARENAS[Math.floor(Math.random() * ARENAS.length)];
}

export function getArenaById(id) {
  return ARENAS.find((a) => a.id === id) ?? ARENAS[0];
}
