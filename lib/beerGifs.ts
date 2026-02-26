export const BEER_GIFS = [
  "https://media.giphy.com/media/l0MYEqEzwMWFCg8rm/giphy.gif",
  "https://media.giphy.com/media/3oEdv9Y8md1SwyOMYE/giphy.gif",
  "https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif",
  "https://media.giphy.com/media/l2JhtKtDWYNKdRpoA/giphy.gif",
  "https://media.giphy.com/media/26FLdaDQ5f7xAfR44/giphy.gif",
  "https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif",
  "https://media.giphy.com/media/3oEdva9BUHPIs2SkGk/giphy.gif",
  "https://media.giphy.com/media/l0MYJnJQ4EiYLxvQ4/giphy.gif",
];

export function getRandomBeerGif(): string {
  return BEER_GIFS[Math.floor(Math.random() * BEER_GIFS.length)];
}
