/** Post-match win quotes keyed by character id. */
export const WIN_QUOTES = {
  deku: 'I have to go beyond… Plus Ultra!',
  allmight: 'The symbol of peace always finds a way!',
  todoroki: 'Hot and cold — that is my power.',
  bakugo: 'Die already! I am the future number one hero!',
  uraraka: 'Zero gravity — make it float!',
  shigaraki: 'Destroy… everything.',
  allforone: 'This world needs a new ruler.',
  dabi: 'Watch the blue flames consume you.',
  stain: 'Only the worthy may call themselves heroes.',
  twice: 'Twice the fun — copy that!',
  overhaul: 'Filth… I will restructure everything.',
};

export function getWinQuote(characterId) {
  return WIN_QUOTES[characterId] ?? 'Victory!';
}
