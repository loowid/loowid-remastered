const ANIMALS = [
  'adder', 'ant', 'anteater', 'antelope', 'badger', 'bat', 'bear', 'beaver', 'bee', 'beetle',
  'bird', 'bison', 'boar', 'buffalo', 'bull', 'butterfly', 'calf', 'camel', 'canary', 'cat',
  'caterpillar', 'centipede', 'chameleon', 'cheetah', 'chicken', 'chimpanzee', 'cicada',
  'cockroach', 'condor', 'cougar', 'cow', 'coyote', 'crab', 'cricket', 'crocodile', 'crow',
  'deer', 'dog', 'dolphin', 'donkey', 'dragonfly', 'dromedary', 'duck', 'eagle', 'elephant',
  'elk', 'falcon', 'ferret', 'fish', 'fly', 'fox', 'frog', 'giraffe', 'goat', 'goldfish',
  'goose', 'gorilla', 'grasshopper', 'groundhog', 'hamster', 'hare', 'hedgehog', 'hen',
  'hippopotamus', 'horse', 'hyena', 'iguana', 'jackal', 'jaguar', 'kangaroo', 'lamb',
  'leopard', 'lion', 'lizard', 'lobster', 'locust', 'lynx', 'mammoth', 'mare', 'marten',
  'mink', 'mole', 'monkey', 'moose', 'mosquito', 'moth', 'mouse', 'mule', 'octopus',
  'orangutan', 'ostrich', 'otter', 'owl', 'ox', 'oyster', 'panda', 'panther', 'parakeet',
  'parrot', 'peacock', 'pelican', 'penguin', 'pheasant', 'pig', 'pigeon', 'dove', 'pony',
  'porcupine', 'rabbit', 'raccoon', 'rat', 'reindeer', 'rhinoceros', 'salamander', 'scorpion',
  'seal', 'shark', 'sheep', 'sheepdog', 'sloth', 'slug', 'snail', 'snake', 'spider', 'squirrel',
  'stag', 'stork', 'swan', 'tiger', 'toad', 'tortoise', 'turkey', 'turtle', 'viper', 'vixen',
  'vulture', 'walrus', 'wasp', 'weasel', 'whale', 'wolf', 'worm', 'zebra'
];

const BEGIN_HEROES = ['captain', 'super', 'ultra', 'wonder', 'mega', 'lord', 'black', 'white'];
const END_HEROES = ['man', 'woman', 'boy', 'girl', 'diamond', 'shadow', 'rider'];

const getCapitalize = (list: string[]): string => {
  const string = list[Math.floor(Math.random() * list.length)];
  return string.charAt(0).toUpperCase() + string.slice(1);
};

export function getRandomHero(): string {
  const animals = [
    'Batman', 'Superman', 'Wonder Woman', 'Spider-Man', 'Iron Man',
    'Thor', 'Hulk', 'Captain America', 'Black Widow', 'Wolverine',
    'Flash', 'Aquaman', 'Doctor Strange', 'Black Panther', 'Captain Marvel',
    'Deadpool', 'Daredevil', 'Green Lantern', 'Hawkman', 'Hawkeye',
    'Supergirl', 'Batgirl', 'Robin', 'Nightwing', 'Ant-Man',
    'Wasp', 'Vision', 'Scarlet Witch', 'Falcon', 'Winter Soldier',
    'Star-Lord', 'Gamora', 'Groot', 'Rocket Raccoon', 'Drax',
    'Storm', 'Cyclops', 'Jean Grey', 'Beast', 'Gambit',
    'Rogue', 'Nightcrawler', 'Silver Surfer', 'Human Torch', 'Thing',
    'Mr. Fantastic', 'Invisible Woman', 'Shazam', 'Martian Manhunter', 'Cyborg'
  ];
  return animals[Math.floor(Math.random() * animals.length)];
}

export function getSuperHero(): string {
  const animal = getCapitalize(ANIMALS);
  const heroBeg = getCapitalize(BEGIN_HEROES);
  const heroEnd = getCapitalize(END_HEROES);
  return (Math.random() * 10 > 4) ? animal + heroEnd : heroBeg + animal;
}

export function isHeroName(name: string): boolean {
  return /(Boy|Man|Woman|Girl)/.test(name);
}

export function getHeroImage(name: string): 'hero' | 'heroine' {
  return 'hero';
}

export function getStoredOrRandomName(roomId: string): string {
  try {
    const saved = localStorage.getItem(`loowid_name_${roomId}`) || localStorage.getItem('loowid_user_name');
    if (saved && saved.trim()) return saved.trim();
  } catch { /* ignore */ }
  const hero = getRandomHero();
  try {
    localStorage.setItem('loowid_user_name', hero);
  } catch { /* ignore */ }
  return hero;
}

export function saveUserName(name: string, roomId?: string): void {
  try {
    localStorage.setItem('loowid_user_name', name);
    if (roomId) localStorage.setItem(`loowid_name_${roomId}`, name);
  } catch { /* ignore */ }
}
