module.exports.randomColor = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

module.exports.countBits = (userBits) => {
  const target = 500;
  if (userBits < target) return 0;
  return Math.floor(userBits / target);
};
module.exports.countChickenBits = (userBits) => {
  const target = 100;
  if (userBits < target) return 0;
  return Math.floor(userBits / target);
};
