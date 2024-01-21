import { fakerFR } from '@faker-js/faker';
import { prisma } from '#lib';
import { CredentialType, GroupType, LogoSourceType, Visibility, type Prisma } from '@prisma/client';
import { hash } from 'argon2';
import { exit } from 'node:process';
import slug from 'slug';
import { createUid } from './services/registration.js';
import { isBooleanObject } from 'node:util/types';

const faker = fakerFR; //j'avais la flemme de faire des FakerFRFR.machin partout
faker.seed(5);

let numberUserDB : number = 50; //Nombre d'utilisateur dans la DB de test

//définitio de l'ensemble des enum défini pour générer des données avec faker
enum role{
    Prez,
    Trez,
    VP,
    Secrétaire,
    Membre
};



interface User {
    firstName : string,
    lastName : string
    admin? : Boolean,
    canEditGroups? : Boolean,
    canEditUsers? : Boolean, 
}

function* range(start: number, end: number): Generator<number> {
    for (let i = start; i < end; i++) yield i;
    //js weighted array random
  }


 //const graduationYears = [...range()]
  
  type SizedArray<T, N extends number> = N extends N
    ? number extends N
      ? T[]
      : _TupleOf<T, N, []>
    : never;
  type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N
    ? R
    : _TupleOf<T, N, [T, ...R]>;
  
  const color = (str: string) => {
    let hash = 0xc0_ff_ee;
    /* eslint-disable */
    for (const char of str) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    const red = ((hash & 0xff0000) >> 16) + 1;
    const green = ((hash & 0x00ff00) >> 8) + 1;
    const blue = (hash & 0x0000ff) + 1;
    /* eslint-enable */
    const l = 0.4 * red + 0.4 * green + 0.2 * blue;
    const h = (n: number) =>
      Math.min(0xd0, Math.max(0x60, Math.floor((n * 0xd0) / l)))
        .toString(16)
        .padStart(2, '0');
    return `#${h(red)}${h(green)}${h(blue)}`;
  };
  
  function randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)]!;
  }
  
  function randomIdOf(objects: Array<{ id: string }>): string {
    return randomChoice(objects).id;
  }
  
  function randomIdsOf<Count extends number>(
    objects: Array<{ id: string }>,
    count: Count,
  ): SizedArray<string, Count> {
    const result = [] as string[];
    let pool = objects;
    while (result.length < count) {
      const choice = randomChoice(pool);
      result.push(choice.id);
      pool = pool.filter((o) => o.id !== choice.id);
    }
  
    return result as SizedArray<string, Count>;
  }
  
  // randomizes hours and minutes from given date
  function randomTime(date: Date, hoursIn: Generator<number>): Date {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      randomChoice([...hoursIn]),
      Math.floor(Math.random() * 60),
    );
}


//Génération d'un user aléatoire
/*
function createUser(): Prisma.UserCreateInput{ 
    const firstName = faker.person.firstName()
    const lastName = faker.person.lastName()
    return {
      firstName, lastName, uid: await createUid({firstName, lastName}),
      email: faker.internet.email({firstName, lastName}), 
    }
  };
}*/

//User rigolo de l'ancienne DB de test, que personne y touche on en est fier.
let usersData : { firstName : string, lastName : string }[] = [
  { firstName: 'Annie', lastName: 'Versaire' },
  { firstName: 'Bernard', lastName: 'Tichaut' },
  { firstName: 'Camille', lastName: 'Honnête' },
  { firstName: 'Denis', lastName: 'Chon' },
  { firstName: 'Élie', lastName: 'Coptère' },
  { firstName: 'Fred', lastName: 'Voyage' },
  { firstName: 'Gérard', lastName: 'Menvu' },
  { firstName: 'Henri', lastName: 'Cochet' },
  { firstName: 'Inès', lastName: 'Alamaternité' },
  { firstName: 'Jennifer', lastName: 'Arepassé' },
  { firstName: 'Kelly', lastName: 'Diote' },
  { firstName: 'Lara', lastName: 'Clette' },
  { firstName: 'Marc', lastName: 'Des Points' },
  { firstName: 'Nordine', lastName: 'Ateur' },
  { firstName: 'Otto', lastName: 'Graf' },
  { firstName: 'Paul', lastName: 'Ochon' },
  { firstName: 'Quentin', lastName: 'Deux Trois' },
  { firstName: 'Rick', lastName: 'Astley' },
  { firstName: 'Sacha', lastName: 'Touille' },
  { firstName: 'Thérèse', lastName: 'Ponsable' },
  { firstName: 'Urbain', lastName: 'De Bouche' },
  { firstName: 'Vivien', lastName: 'Chezmoi' },
  { firstName: 'Wendy', lastName: 'Gestion' },
  { firstName: 'Xavier', lastName: 'K. Paétrela' },
  { firstName: 'Yvon', lastName: 'Enbavé' },
  { firstName: 'Zinédine', lastName: 'Pacesoir' },
];

//ajout d'utilisateur aléatoire par Faker
for (let i=0; i < numberUserDB - usersData.length; i++){
  usersData.push( {firstName : faker.person.firstName(), lastName: faker.person.lastName()} );
}

let majorList : string[] = ["SN", "MFEE", "EEEA"];

let emailUserList : string[] = []
for(let i =0; i < 50; i++){
  emailUserList.push(faker.internet.email({ firstName: usersData[i]?.firstName, lastName: usersData[i]?.lastName }));
}
console.log(emailUserList);
console.log(faker.lorem.paragraph({ min : 0, max : 50}));

/*
for (const[i, data] of usersData.entries()){
    await prisma.user.create({
      data: {
          ...data,
          email : faker.internet.email({ firstName : data.firstName, lastName : data.firstName}),
          description : faker.lorem.paragraph({ min : 0, max : 50}),
          links: {
            create: [
              { name: 'Facebook', value: '#'},
              { name: 'Instagram', value: '#' },
              { name: 'Telegram', value: '#' },
              { name: 'Twitter', value: '#' },
            ]
          },
          contributions:
            faker.number.int() % 2 === 0 
              ? {
                create: {
                  paid: true,
                  option: {
                    connect: {
                      id: contributionOptions.find((option) =>
                        major.schools.some((school) => school.id === option.offeredInId),
                      )!.id,
                    },
                  },
                },
              }
      }
    })

}
commenté pour éviter d'exploser le pipeline
*/

const schoolsData = [
    {
      name: 'EAU',
      uid: 'o',
      color: '#00ffff',
      description: 'École de l’Eau',
      address: '2 rue Charles Camichel, 31000 Toulouse', //gener
    },
    {
      name: 'FEU',
      uid: 'feu',
      color: '#b22222',
      description: 'École de Feu',
      address: '2 rue Charles Camichel, 31000 Toulouse',
    },
    {
      name: 'TERRE',
      uid: '3',
      color: '#5e3f13',
      description: 'École de Terre',
      address: '2 rue Charles Camichel, 31000 Toulouse',
    },
    {
      name: 'AIR',
      uid: 'air',
      color: '#d9eaff',
      description: 'École de l’Air',
      address: '2 rue Charles Camichel, 31000 Toulouse',
    },
  ];
  
  const servicesData = [
    {
      name: 'Moodle',
      description: 'Plateforme de cours',
      url: 'https://moodle-n7.inp-toulouse.fr/',
      logo: 'https://copyleaks.com/wp-content/uploads/2022/08/moodle-m-with-grid-1024x1024.png',
      logoSourceType: LogoSourceType.ExternalLink,
    },
    {
      name: 'EDT',
      description: 'Emploi du temps',
      url: 'https://edt-n7.inp-toulouse.fr/',
      logo: 'Calendar',
      logoSourceType: LogoSourceType.Icon,
    },
  ];

for (const school of schoolsData) {
  await prisma.school.create({
    data: {
      ...school,
      services: {
        createMany: {
          data: servicesData,
        },
      },
    },
  });
}

const schools = await prisma.school.findMany();

const mecaniqueDesFluides = await prisma.major.create({
  data: {
    shortName: 'MFEE',
    uid: 'mfee',
    name: 'Mécanique des fluides',
    schools: { connect: { id: schools[0]!.id } },
  },
});
const sciencesDuNumerique = await prisma.major.create({
  data: {
    shortName: 'SN',
    uid: 'sn',
    name: 'Sciences du Numérique',
    schools: { connect: { id: schools[0]!.id } },
  },
});

const elec = await prisma.major.create({
  data: {
    shortName: 'EEEA',
    uid: 'eeea', 
    name: 'éléectronique, énergie électrique & automatique',
    schools: { connect: { id: schools[0]!.id } },
  },
});

const majors = [mecaniqueDesFluides, sciencesDuNumerique, elec];

interface subject{

}

/*function createSubject(): subject{ 
    return{
        firstName: faker.person.firstName(),
        lastName: faker.person.firstName()
    };
}*/