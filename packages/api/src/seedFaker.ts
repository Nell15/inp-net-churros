import { fakerFR } from '@faker-js/faker';
import { prisma } from '#lib';
import { CredentialType, GroupType, LogoSourceType, Visibility, type Prisma } from '@prisma/client';
import { hash } from 'argon2';
import slug from 'slug';
import { createUid } from './services/registration.js';

const faker = fakerFR; //j'avais la flemme de faire des FakerFRFR.machin partout
faker.seed(5); //seed de génération de la DB, pour générer une DB avec de nouvelles données il suffit juste de changer la valeur de la seed

let numberUserDB : number = 50; //Nombre d'utilisateur dans la DB de test

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
const schoolsData = [
  {
    name: 'EAU',
    uid: 'o',
    color: '#00ffff',
    description: 'École de l’Eau',
    address: '2 rue Charles Camichel, 31000 Toulouse', //generation par faker possible ???
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

const plomberie = await prisma.subject.create({
  data: {
    name: "Plomberie",
    uid: 'plomberie',
    majors: { connect: [{ id: mecaniqueDesFluides.id }] },
    yearTier: 1,
    forApprentices: false,
  },
});

const chomeur = await prisma.subject.create({
  data: {
    name: "Chomeur",
    uid: 'chomeur',
    majors: { connect: [{ id: mecaniqueDesFluides.id }] },
    yearTier: 1,
    forApprentices: false,
  },
});

const transistor = await prisma.subject.create({
  data: {
    name: "Transistor",
    uid: 'transistor',
    majors: { connect: [{ id: elec.id }] },
    yearTier: 1,
    forApprentices: false,
  },
});
const cableElec = await prisma.subject.create({
  data: {
    name: "Cable Elec",
    uid: 'cable-elec',
    majors: { connect: [{ id: elec.id }] },
    yearTier: 1,
    forApprentices: false,
  },
});

const ia = await prisma.subject.create({
  data: {
    name: "IA (fraude)",
    uid: 'ia',
    majors: { connect: [{ id: sciencesDuNumerique.id }] },
    yearTier: 1,
    forApprentices: false,
  },
});

const rezo = await prisma.subject.create({
  data: {
    name: "Rezo",
    uid: 'rezo',
    majors: { connect: [{ id: elec.id }] },
    yearTier: 1,
    forApprentices: false,
  },
});

const minors = [plomberie, chomeur, transistor, cableElec, ia, rezo];


for (const [i, name] of ['AE EAU 2022', 'AE FEU 2022', 'AE TERRE 2022', 'AE AIR 2022'].entries()) {
  await prisma.studentAssociation.create({
    data: {
      uid: slug(name),
      description: 'Une association étudiante',
      name,
      school: { connect: { id: schools[i]!.id } },
      links: { create: [] },
      lydiaAccounts: {
        create: {
          name,
          vendorToken: 'b',
          privateToken: 'b',
        },
      },
    },
  });
}

const studentAssociations = await prisma.studentAssociation.findMany({ include: { school: true } });

for (const asso of studentAssociations) {
  for (const name of ['FOY', 'BDE', 'BDD', 'BDA', 'BDS']) {
    await prisma.group.create({
      data: {
        name,
        uid: slug(name + ' ' + asso.name),
        color: color(name),
        type: GroupType.StudentAssociationSection,
        studentAssociation: { connect: { id: asso.id } },
        links: {
          create: [],
        },
        address: '2 rue Charles Camichel, 31000 Toulouse',
        email: `${slug(name)}@list.example.com`,
        lyiaAccounts: {
          create: {
            name: `${asso.school.name.toUpperCase()} ${name.toUpperCase()}`,
            privateToken: 'a',
            vendorToken: 'a',
          },
        },
      },
    });
  }
}

const studentAssociationsWithLydiaAccounts = await prisma.studentAssociation.findMany({
  include: { school: true, lydiaAccounts: true },
});

for (const ae of studentAssociationsWithLydiaAccounts) {
  await prisma.contributionOption.create({ //
    data: {
      paysFor: { connect: { id: ae.id } },
      name: ae.name,
      offeredIn: { connect: { id: ae.school.id } },
      price: faker.number.int({ min : 30, max: 200}),
      beneficiary:
        ae.lydiaAccounts.length > 0 ? { connect: { id: ae.lydiaAccounts[0]?.id } } : undefined,
    },
  });
}

const contributionOptions = await prisma.contributionOption.findMany({
  include: { offeredIn: true },
});

//User rigolo de l'ancienne DB de test, que personne y touche on en est fier.
const usersData = [
  { firstName: 'Annie', lastName: 'Versaire', admin: true}, //Unique compte de la DB qui possède les droits admin
  { firstName: 'Bernard', lastName: 'Tichaut', canEditGroups: true }, //Unique compte "respo club"
  { firstName: 'Camille', lastName: 'Honnête', canEditUsers: true },
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
  { firstName: 'Rick', lastName: 'Astley'} //https://www.youtube.com/watch?v=dQw4w9WgXcQ
];

//ajout d'utilisateur aléatoire par Faker
for (let i=0; i < numberUserDB - usersData.length; i++){
  usersData.push( {firstName : faker.person.firstName(), lastName: faker.person.lastName()} );
}


/* -- Section debug --
let emailUserList : string[] = [];
let phoneUserList : string[] = [];
let birthUserList : Date[] = [];
let graduationYearList : number[] = [];

for(let i =0; i < numberUserDB; i++){
  emailUserList.push(faker.internet.email({ firstName: usersData[i]?.firstName, lastName: usersData[i]?.lastName }));
  phoneUserList.push(faker.location.streetAddress());
  birthUserList.push(faker.date.birthdate({ min : 17, max : 25, mode: "age"}))
  graduationYearList.push(faker.helpers.weightedArrayElement([
    { weight: 10, value: 2026 },
    { weight: 10, value: 2025 },
    { weight: 10, value: 2024 },
    { weight: 3, value: 2023},
    {weight: 1, value:2022}
  ]))
}
console.log(emailUserList);
console.log(phoneUserList);
console.log(birthUserList);
console.log(graduationYearList);
*/

for (const[_, data] of usersData.entries()){
  const major = await prisma.major.findUniqueOrThrow({
    where : { id: faker.helpers.arrayElement(majors).id},
    include: { schools : true},
  })
    await prisma.user.create({
      data: {
          ...data,
          uid: await createUid(data),
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
            faker.number.int({ min : 0, max: 10 }) % 10 === 0 //génération d'une majorité de cotissant
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
              : undefined,
          phone: faker.phone.number(),
          address: faker.location.streetAddress(),
          birthday: faker.date.birthdate({ min : 17, max : 25, mode: "age"}),
          graduationYear : faker.helpers.weightedArrayElement([
            { weight: 10, value: 2026 },
            { weight: 10, value: 2025 },
            { weight: 10, value: 2024 },
            { weight: 3, value: 2023 },
            { weight: 1, value:2022 }
          ]),
          major: { connect: { id : major.id }},
          credentials: { create: { type: CredentialType.Password, value: await hash('a') } },
          canAccessDocuments: true,
      },
    });

}

const users = await prisma.user.findMany();
const userEEEA = users.filter((element) => element.majorId === "eaaa");

let numberSubject : number = 10; 
//creation de nbSubject pour toute les mineurs des filières possible
for (const[i, minor] of minors.entries()){
  for(let j=0; j< numberSubject; j++){
      await prisma.document.create({
        data:{
          description: faker.lorem.paragraph({ min : 2, max : 10}),
          title: 'Un document',
          uid: 'un-document',
          schoolYear: faker.number.int({ min : 2015, max : 2024}),
          subject: { connect: { id: minors[i]?.id } }, 
          type: 'Exam',
          uploader: { connect: { uid: faker.helpers.arrayElement(users.filter((element) => element.minorId === minor.id)).uid } }, //recup uniquement les users de la bonne mineur pour en faire des auteurs
        }
      })
    }
}


interface subject{

}

/*function createSubject(): subject{ 
    return{
        firstName: faker.person.firstName(),
        lastName: faker.person.firstName()
    };
}*/