export const WEAPONS = {
  pistol: { name: 'Pistol', icon: '🔫', cd: 0.25, speed: 0,  r: 0,   f: 520 },
  knife:  { name: 'Pisau',  icon: '🔪', cd: 0.5,  speed: 55, r: 0.5, f: 320, shape: 'knife' },
  bow:    { name: 'Busur',  icon: '🏹', cd: 0.8,  speed: 38, r: 0.7, f: 240, shape: 'arrow' }
};
// time = detik, spawn = jeda munculnya target, speed = kecepatan terbang, size = skala target, mult = pengali poin, goal = target poin menang
export const LEVELS = {
  easy:   { name: 'Mudah', time: 60, spawn: 1.1, speed: 3, size: 1.5, mult: 1, goal: 150 },
  medium: { name: 'Sedang', time: 60, spawn: 0.75, speed: 5.5, size: 1.1, mult: 2, goal: 500 },
  hard:   { name: 'Sulit', time: 60, spawn: 0.45, speed: 9, size: 0.8, mult: 3, goal: 1000 }
};
