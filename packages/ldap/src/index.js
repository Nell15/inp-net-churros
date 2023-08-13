/* eslint-disable */
import ldap from 'ldapjs';
import { PrismaClient } from '../../../node_modules/@prisma/client';
import argon2 from 'argon2';
import dotenv from 'dotenv';
import { parseDNToList, findByKey, scope, printList } from './utils';

// Load .env file
dotenv.config();
const rootDn = process.env.LDAP_ROOT_DN || 'dc=example, dc=com';
const ldapPort = parseInt(process.env.LDAP_PORT) || 389;

// Some constants
const SUPPORTED_CONTROLS = [
  '1.3.6.1.4.1.4203.1.10.1', // ManageDsaIT
  '2.16.840.1.113730.3.4.18', // Assertion
  '2.16.840.1.113730.3.4.2', // Subentries
];

const SUPPORTED_MECHANISMS = ['PLAIN', 'EXTERNAL'];

const createRootDSE = () => {
  return {
    configContext: 'cn=config',
    namingContexts: [rootDn],
    objectclass: ['top', 'OpenLDAProotDSE'],
    structuralObjectClass: 'OpenLDAProotDSE',
    subschemaSubentry: 'cn=Subschema',
    supportedControl: SUPPORTED_CONTROLS,
    supportedLDAPVersions: ['3'],
    supportedSASLMechanisms: SUPPORTED_MECHANISMS,
  };
};

// Init ldap server and prisma client
const server = ldap.createServer();
const prisma = new PrismaClient();

/////////////////////////////////////////////
//       Code to handle LDAP requests      //
/////////////////////////////////////////////

server.bind(`${rootDn}`, async (req, res, next) => {
  const bindDN = parseDNToList(req.dn);
  const bindPassword = req.credentials;

  // Anonymous bind
  if (!bindDN || bindPassword === '') {
    res.end();
    return next();
  }

  try {
    // Look up user by bind DN (e.g., "uid=user123,ou=users,o=school,dc=mydomain,dc=com")
    const ldapUser = await prisma.userLdap.findUnique({
      where: {
        uid: findByKey(bindDN,'uid')[0],
      },
      include: {
        user: {
          include: {
            credentials: true,
            major: {
              include: {
                schools: {
                  include: {
                    schoolLdap: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!ldapUser) {
      return next(new ldap.InvalidCredentialsError('Invalid credentials'));
    }

    // Verify school
    if (
      !ldapUser.user.major.schools.find(
        (school) => school.schoolLdap.o == findByKey(bindDN,'o')[0],
      )
    ) {
      return next(new ldap.InvalidCredentialsError('User is not is this school'));
    }

    // Verify the bind password
    if (ldapUser.user) {
      for (const { value } of ldapUser.user.credentials) {
        if (await argon2.verify(value, bindPassword)) {
          // Successful bind
          res.end();
          return next();
        }
      }
    }
    return next(new ldap.InvalidCredentialsError('Invalid credentials'));
  } catch (error) {
    console.error('LDAP bind error:', error);
    return next(new ldap.InvalidCredentialsError('Invalid credentials'));
  }
});

server.search('', async (req, res, next) => {
  try {
    if (
      req.scope === 'base' &&
      req.filter instanceof ldap.PresenceFilter &&
      req.filter.attribute === 'objectclass'
    ) {
      res.send({
        dn: rootDn,
        attributes: createRootDSE(),
      });
    }

    res.end();
    return next();
  } catch (error) {
    console.error('Error handling rootDSE search request:', error);
    res.end(new ldap.OtherError(error.message));
    return next(error);
  }
});

// Subschema
server.search('cn=Subschema', async (req, res, next) => {
  console.log('cn=Subschema');
  try {
    res.send({
      dn: 'cn=Subschema',
      attributes: {
        objectclass: ['top', 'subentry', 'subschema'],
        cn: 'Subschema',
      },
    });
    res.end();
    return next();
  } catch (error) {
    console.error('Error handling search request:', error);
    res.end(new ldap.OtherError(error.message));
    return next(error);
  }
});

// Search rootDn
server.search(rootDn, async (req, res, next) => {
  const context = scope(parseDNToList(req.dn));
  console.log('DN: ' + req.dn.toString());
  console.log('Filter: ' + req.filter.toString());
  console.log('Attributes: ' + req.attributes.toString());
  console.log('Scope: ' + req.scope);
  console.log('Context: ' + context.type);

  switch (context.type) {
    case 'rootDN':
      try {
        if (
          req.scope === 'base' || req.scope === 'sub'
        ) {
          console.log('search request for rootDn');
          res.send({
            dn: 'dc=etu-inpt,dc=fr',
            attributes: {
              objectclass: ['top', 'dcObject', 'organization'],
              o: 'inp-net',
              dc: 'etu-inpt',
            },
          });
        }
        if (req.scope === 'sub' || req.scope === 'one') {
          const schoolsLdap = await prisma.schoolLdap.findMany({
            include: { school: true, ObjectClass: true },
          });
          for (let schoolLdap of schoolsLdap.values()) {
            res.send({
              dn: `o=${schoolLdap.o},${rootDn}`,
              attributes: {
                displayName: schoolLdap.school.name,
                objectclass: schoolLdap.ObjectClass.map((object) => object.attribute),
                o: schoolLdap.o,
              },
            });
          }
        }
        res.end();
        return next();
      } catch (error) {
        console.error('Error handling search request:', error);
        res.end(new ldap.OtherError(error.message));
        return next(error);
      }
    case 'school':
      try {
        const schoolLdap = await prisma.schoolLdap.findUnique({
          where: {
            o: context.school,
          },
          include: { school: true, ObjectClass: true },
        });
        if (
          req.scope === 'base' || req.scope === 'sub'
        ) {
          res.send({
            dn: `o=${schoolLdap.o},dc=etu-inpt,dc=fr`,
            attributes: {
              displayName: schoolLdap.school.name,
              o: schoolLdap.o,
              objectclass: schoolLdap.ObjectClass.map((object) => object.attribute),
            },
          });
        }
        if (req.scope === 'sub' || req.scope === 'one') {
          res.send({
            dn: `ou=people,o=${schoolLdap.o},dc=etu-inpt,dc=fr`,
            attributes: {
              objectclass: ['organizationalUnit'],
              ou: 'people',
            },
            }
          );
          res.send({
            dn: `ou=groups,o=${schoolLdap.o},dc=etu-inpt,dc=fr`,
            attributes: {
              objectclass: ['organizationalUnit'],
              ou: 'groups',
            },
          });
          res.send({
            dn: `ou=filieres,o=${schoolLdap.o},dc=etu-inpt,dc=fr`,
            attributes: {
              objectclass: ['organizationalUnit'],
              ou: 'filieres',
            },
          });
          res.send({
            dn: `ou=admin,o=${schoolLdap.o},dc=etu-inpt,dc=fr`,
            attributes: {
              objectclass: ['organizationalUnit'],
              ou: 'admin',
            },
          });
          res.send({
            dn: `ou=aliases,o=${schoolLdap.o},dc=etu-inpt,dc=fr`,
            attributes: {
              objectclass: ['organizationalUnit'],
              ou: 'aliases',
            },
          });
        }
        res.end();
        return next();
      } catch (error) {
        console.error('Error handling search request:', error);
        res.end(new ldap.OtherError(error.message));
        return next(error);
      }
    case 'kind':
      switch (context.kind) {
        case 'people':
          console.log('search request for kind people');
          try {
            const schoolsLdap = await prisma.schoolLdap.findMany({
              where: context.school !== null ? { o: context.school } : undefined,
              include: { school: true, ObjectClass: true },
            });
            if (
              req.scope === 'base' || req.scope === 'sub'
            ) {
              for (let schoolLdap of schoolsLdap.values()) {
                res.send({
                  dn: `ou=people,o=${schoolLdap.o},dc=etu-inpt,dc=fr`,
                  attributes: {
                    objectclass: ['organizationalUnit'],
                    ou: 'people',
                  },
                });
              }
            }
            if (req.scope === 'sub' || req.scope === 'one') {
              const usersLdap = await prisma.userLdap.findMany({
                where: context.school !== null ? { user: { major: { schools: { some: { schoolLdap: { o: context.school } } } } } } : undefined,
                include: {
                  ObjectClass: true,
                  user: {
                    include: {
                      major: {
                        include: {
                          schools: {
                            include: {
                              schoolLdap: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              });
              for (let userLdap of usersLdap.values()) {
                res.send({
                  dn: `uid=${userLdap.uid},ou=people,o=${userLdap.user.major.schools[0].schoolLdap.o},dc=etu-inpt,dc=fr`,
                  attributes: {
                    cn: userLdap.user.firstName + ' ' + userLdap.user.lastName,
                    displayName: userLdap.user.firstName + ' ' + userLdap.user.lastName,
                    ecole: `o=${userLdap.user.major.schools[0].schoolLdap.o},dc=etu-inpt,dc=fr`,
                    gidNumber: userLdap.gidNumber,
                    givenName: userLdap.user.firstName,
                    hasWebsite: userLdap.hasWebsite,
                    homeDirectory: userLdap.homeDirectory,
                    loginShell: userLdap.loginShell,
                    mailEcole: userLdap.user.schoolEmail,
                    objectclass: userLdap.ObjectClass.map((object) => object.attribute),
                    sn: userLdap.user.lastName,
                    snSearch: userLdap.user.lastName.toLocaleLowerCase(),
                    uidNumber: userLdap.uidNumber,
                    uid: userLdap.uid,
                    hasSubordinates: false,
                  },
                });
              }
            }
            res.end();
            return next();
          } catch (error) {
            console.error('Error handling search request:', error);
            res.end(new ldap.OtherError(error.message));
            return next(error);
          }
        case 'groups':
          try {
            const schoolsLdap = await prisma.schoolLdap.findMany({
              where: context.school !== null ? { o: context.school } : undefined,
              include: { school: true, ObjectClass: true },
            });
            
            if (
              req.filter instanceof ldap.PresenceFilter &&
              req.filter.attribute === 'objectclass' &&
              req.scope === 'base' || req.scope === 'sub'
            ) {
              for (let schoolLdap of schoolsLdap.values()) {
                res.send({
                  dn: `ou=groups,o=${schoolLdap.o},dc=etu-inpt,dc=fr`,
                  attributes: {
                    objectclass: ['organizationalUnit'],
                    ou: 'groups',
                  },
                });
              }
            }
            if (req.scope === 'sub' || req.scope === 'one') {
              for (let schoolLdap of schoolsLdap.values()) {
                res.send({
                  dn: `ou=clubs,ou=groups,o=${schoolLdap.o},dc=etu-inpt,dc=fr`,
                  attributes: {
                    ou: 'clubs',
                    objectclass: ['organizationalUnit'],
                  },
                });
                res.send({
                  dn: `ou=grp-informels,ou=groups,o=${schoolLdap.o},dc=etu-inpt,dc=fr`,
                  attributes: {
                    ou: 'grp-informels',
                    objectclass: ['organizationalUnit'],
                  },
                });
              }
            }
            res.end();
            return next();
          } catch (error) {
            console.error('Error handling search request:', error);
            res.end(new ldap.OtherError(error.message));
            return next(error);
          };
        case 'filieres':
          res.end();
          break;
        case 'admin':
          res.end();
          break;
        case 'aliases':
          res.end();
          break;
        default:
          res.end();
          break;
      }
      break;
    case 'secondKind':
      switch (context.secondKind) {
        case 'clubs':
          const schoolsLdap = await prisma.schoolLdap.findMany({
            where: context.school !== null ? { o: context.school } : undefined,
            include: { school: true, ObjectClass: true },
          });

          if (
            req.scope === 'base' || req.scope === 'sub'
          ) {
            for (let schoolLdap of schoolsLdap.values()) {
              res.send({
                dn: `ou=clubs,ou=groups,o=${schoolLdap.o},dc=etu-inpt,dc=fr`,
                attributes: {
                  ou: 'clubs',
                  objectclass: ['organizationalUnit'],
                  hasSubordinates: true,
                },
              });
            }
          } 
          if (req.scope === 'sub' || req.scope === 'one') {
            const clubsLdap = await prisma.groupLdap.findMany({
              where: context.school !== null ? { group: { school: { schoolLdap: { o: context.school } } } } : undefined,
              include: {
                ObjectClass: true,
                group: {
                  include: {
                    members: {
                      include: {
                        member: {
                          include: {
                            userLdap: true,
                          },
                        },
                      },
                    },
                    school: {
                      include: {
                        schoolLdap: true,
                      },
                    },
                  },
                },
              },
            });
            for (let clubLdap of clubsLdap.values()) {
              res.send({
                dn: `cn=${clubLdap.cn},ou=clubs,ou=groups,o=${clubLdap.group.school.schoolLdap.o},dc=etu-inpt,dc=fr`,
                attributes: {
                  cn: clubLdap.cn,
                  displayName: clubLdap.cn,
                  ecole: `o=${clubLdap.group.school.schoolLdap.o},dc=etu-inpt,dc=fr`,
                  gidNumber: clubLdap.gidNumber,
                  hasWebsite: clubLdap.hasWebsite,
                  memberUid: clubLdap.group.members.map((member) => member.member.userLdap.uid),
                  objectclass: clubLdap.ObjectClass.map((object) => object.attribute),
                },
              });
            }
          }
          res.end();
          return next();
        case 'grp-informels':
          res.end();
          break;
        default:
          res.end();
          break;
      }
    case 'group':
      res.end();
      break;
    case 'person':
      try {
        console.log('search request for person: ' + context.person);
        const userLdap = await prisma.userLdap.findUnique({
          where: {
            uid: context.person,
            user: {
              major: {
                schools: {
                  some: {
                    schoolLdap: {
                      o: context.school,
                    },
                  },
                },
              },
            },
          },
          include: {
            ObjectClass: true,
            user: {
              include: {
                major: {
                  include: {
                    schools: {
                      include: {
                        schoolLdap: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!userLdap) {
          res.end();
          return next();
        }

        if (
          req.scope === 'base' || req.scope === 'sub'
        ) {
          res.send({
            dn: `uid=${userLdap.uid},ou=people,o=${!context.school === null ? userLdap.user.major.schools[0].schoolLdap.o : context.school},dc=etu-inpt,dc=fr`,
            attributes: {
              cn: userLdap.user.firstName + ' ' + userLdap.user.lastName,
              displayName: userLdap.user.firstName + ' ' + userLdap.user.lastName,
              ecole: `o=${!context.school === null ? userLdap.user.major.schools[0].schoolLdap.o : context.school},dc=etu-inpt,dc=fr`,
              gidNumber: userLdap.gidNumber,
              givenName: userLdap.user.firstName,
              hasWebsite: userLdap.hasWebsite,
              homeDirectory: userLdap.homeDirectory,
              loginShell: userLdap.loginShell,
              mailEcole: userLdap.user.schoolEmail,
              objectclass: userLdap.ObjectClass.map((object) => object.attribute),
              sn: userLdap.user.lastName,
              snSearch: userLdap.user.lastName.toLocaleLowerCase(),
              uidNumber: userLdap.uidNumber,
              uid: userLdap.uid,
              hasSubordinates: false,
            },
          });
        }
        if (req.scope === 'sub' || req.scope === 'one') {
          res.send({
            dn: `uid=${userLdap.uid},ou=people,o=${!context.school === null ? userLdap.user.major.schools[0].schoolLdap.o : context.school},dc=etu-inpt,dc=fr`,
            attributes: {
              cn: userLdap.user.firstName + ' ' + userLdap.user.lastName,
              displayName: userLdap.user.firstName + ' ' + userLdap.user.lastName,
              ecole: `o=${userLdap.user.major.schools[0].schoolLdap.o},dc=etu-inpt,dc=fr`,
              gidNumber: userLdap.gidNumber,
              givenName: userLdap.user.firstName,
              hasWebsite: userLdap.hasWebsite,
              homeDirectory: userLdap.homeDirectory,
              loginShell: userLdap.loginShell,
              mailEcole: userLdap.user.schoolEmail,
              objectclass: userLdap.ObjectClass.map((object) => object.attribute),
              sn: userLdap.user.lastName,
              snSearch: userLdap.user.lastName.toLocaleLowerCase(),
              uidNumber: userLdap.uidNumber,
              uid: userLdap.uid,
              hasSubordinates: false,
            },
          });
        }
        res.end();
        return next();
      } catch (error) {
        console.error('Error handling search request:', error);
        res.end(new ldap.OtherError(error.message));
        return next(error);
      }
    default:
      res.end();
      break;
  }
});

// Unbind
server.unbind(async (req, res, next) => {
  // Handle unbind request
  // Clean up any resources if necessary
  res.end();
  return next();
});

// Start server
server.listen(ldapPort, () => {
  console.log('LDAP server listening on %s', server.url);
});
prisma;
