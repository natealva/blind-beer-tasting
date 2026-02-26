export const BEER_GIFS = [
  "https://media.giphy.com/media/lTGLOH7ml3poQ6JoFg/giphy.gif",
  "https://media.giphy.com/media/e6TR9n00dL3JS/giphy.gif",
  "https://media.giphy.com/media/h8NdYZJGH1ZRe/giphy.gif",
  "https://media.giphy.com/media/adEcPFyMNEI24/giphy.gif",
  "https://media.giphy.com/media/Ztw0p2RGR36E0/giphy.gif",
  "https://media.giphy.com/media/nDMyoNRkCesJdZAuuL/giphy.gif",
  "https://media.giphy.com/media/8pTkEtZiSd3TogE6xp/giphy.gif",
  "https://media.giphy.com/media/PGVnzm8Ti86x8H5b3j/giphy.gif",
  "https://media.giphy.com/media/o6xoGwmBIb32M/giphy.gif",
  "https://media.giphy.com/media/K34FVrUx8ggyA/giphy.gif",
  "https://media.giphy.com/media/QVtWNLCwgVvnwwvcoq/giphy.gif",
  "https://media.giphy.com/media/rt8W1EZJo50gC07wcl/giphy.gif",
  "https://media.giphy.com/media/DmzUp9lX7lHlm/giphy.gif",
  "https://media.giphy.com/media/J0ySNzZ5APILC/giphy.gif",
];

export function getRandomBeerGif(): string {
  return BEER_GIFS[Math.floor(Math.random() * BEER_GIFS.length)];
}
