module.exports = {
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  randomDelay: (min, max) => new Promise(resolve => 
    setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min))
  ),
  randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
};