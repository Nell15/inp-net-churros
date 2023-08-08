/* eslint-disable */
import ldap from 'ldapjs';
import { PrismaClient } from '../../../node_modules/@prisma/client';
import argon2 from 'argon2';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();
const rootDn = process.env.LDAP_ROOT_DN || 'dc=example, dc=com';
const ldapPort = parseInt(process.env.LDAP_PORT) || 389;

// Some constants
const SUPPORTED_CONTROLS = [
  '1.3.6.1.4.1.4203.1.10.1',      // ManageDsaIT
  '2.16.840.1.113730.3.4.18',    // Assertion
  '2.16.840.1.113730.3.4.2',     // Subentries
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

server.bind('ou=users,dc=mydomain,dc=com', async (req, res, next) => {
  const bindDN = req.dn.toString();
  const bindPassword = req.credentials;

  // Anonymous bind
  if (!bindDN || bindPassword === "") {
    res.end();
    return next();
  }

  try {
    // Look up user by bind DN (e.g., "uid=user123,ou=users,dc=mydomain,dc=com")
    const ldapUser = await prisma.userLdap.findUnique({
      where: { uid: bindDN },
      include: { user:  {
        include: {credentials: true
          },
        },
      },
    });

    if (!ldapUser) {
      return next(new ldap.InvalidCredentialsError('Invalid credentials'));
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

// Search users
server.search(`ou=people,${rootDn}`, async (req, res, next) => {
  console.log(`ou=people,${rootDn} ` + req.scope + req.dn.rdns);
  const dc = req.dn.rdns[0].attrs.cn ? req.dn.rdns[0].attrs.cn.value : 'cn';
  try {
    // Search for one user
    if (dc !== 'cn' && req.filter instanceof ldap.PresenceFilter && req.scope === 'base') {
      const user = await prisma.user.findUnique({
        where: {
          uid: dc,
        },
      });
      if (user) {
        res.send({
          dn: `cn=${user.uid},ou=people,${rootDn}`,
          attributes: {
            cn: user.firstName + ' ' + user.lastName,
            displayName: user.firstName + ' ' + user.lastName,
            givenName: user.firstName,
            homeDirectory: '/home/' + user.uid,
            sn: user.lastName,
            uid: user.uid,
            mail: user.email,
            promo: user.graduationYear,
            objectclass: [
              'top',
              'person',
              'organizationalPerson',
              'inetOrgPerson',
              'posixAccount',
              'shadowAccount',
              'Eleve',
            ],
          },
        });
      }
      res.end();
    } else if (dc !== 'cn' && req.filter instanceof ldap.PresenceFilter && req.scope === 'one') {
      // End of the tree
      res.end();
    } else if (
      req.filter instanceof ldap.PresenceFilter &&
      req.filter.attribute === 'objectclass' &&
      req.scope === 'base'
    ) {
      res.send({
        dn: `ou=people,${rootDn}`,
        attributes: {
          objectclass: ['top', 'organizationalUnit'],
          ou: 'people',
        },
      });
      res.end();
    } else if (
      req.filter instanceof ldap.PresenceFilter &&
      req.filter.attribute === 'objectclass' &&
      req.scope === 'one'
    ) {
      const users = await prisma.user.findMany();
      const ldapUsers = users.map((user) => {
        return {
          dn: `cn=${user.uid},ou=people,${rootDn}`,
          attributes: {
            cn: user.firstName + ' ' + user.lastName,
            displayName: user.firstName + ' ' + user.lastName,
            givenName: user.firstName,
            homeDirectory: '/home/' + user.uid,
            sn: user.lastName,
            uid: user.uid,
            mail: user.email,
            promo: user.graduationYear,
            objectclass: [
              'top',
              'person',
              'organizationalPerson',
              'inetOrgPerson',
              'posixAccount',
              'shadowAccount',
              'Eleve',
            ],
          },
        };
      });
      for (const user of ldapUsers.values()) res.send(user);
      res.end();
    } else if (req.filter instanceof ldap.EqualityFilter && req.filter.attribute === 'uid') {
      const user = await prisma.user.findUnique({
        where: {
          uid: req.filter.value,
        },
      });
      if (user) {
        res.send({
          dn: `cn=${user.uid},ou=people,${rootDn}`,
          attributes: {
            cn: user.firstName + ' ' + user.lastName,
            displayName: user.firstName + ' ' + user.lastName,
            givenName: user.firstName,
            homeDirectory: '/home/' + user.uid,
            sn: user.lastName,
            uid: user.uid,
            mail: user.email,
            promo: user.graduationYear,
            objectclass: [
              'top',
              'person',
              'organizationalPerson',
              'inetOrgPerson',
              'posixAccount',
              'shadowAccount',
              'Eleve',
            ],
          },
        });
      }
      res.end();
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Error handling search request:', error);
    res.end(new ldap.OtherError(error.message));
    return next(error);
  }
});


// Search informal groups
server.search(`ou=grp-informels,ou=groups,${rootDn}`, async (req, res, next) => {
  console.log(`ou=grp-informels,ou=groups,${rootDn} ` + req.scope);
  const dc = req.dn.rdns[0].attrs.cn ? req.dn.rdns[0].attrs.cn.value : 'cn';
  try {
    // Search for one students associations
    if (dc !== 'cn' && req.filter instanceof ldap.PresenceFilter && req.scope === 'base') {
      const grp_informel = await prisma.group.findFirst({
        where: {
          type: 'Group',
          name: dc,
        },
        include: {
          members: {
            include: {
              member: true,
            },
          },
        },
      });
      if (grp_informel) {
        res.send({
          dn: `cn=${grp_informel.name},ou=grp-informels,ou=groups,${rootDn}`,
          attributes: {
            cn: grp_informel.name,
            displayName: grp_informel.name,
            objectclass: ['top', 'groupOfNames', 'Group Informel'],
            memberUid: grp_informel.members.map((member) => member.member.uid),
          },
        });
      }
      res.end();
    } else if (req.filter instanceof ldap.PresenceFilter && req.scope === 'base') {
      res.send({
        dn: `ou=grp-informels,ou=groups,${rootDn}`,
        attributes: {
          objectclass: ['top', 'organizationalUnit'],
          ou: 'grp-informels',
        },
      });
      res.end();
    } else {
      const grp_informels = await prisma.group.findMany({
        where: {
          type: 'Group',
        },
      });
      const ldapGrpInformels = grp_informels.map((grp_informel) => {
        return {
          dn: `cn=${grp_informel.name},ou=grp-informels,ou=groups,${rootDn}`,
          attributes: {
            cn: grp_informel.name,
            displayName: grp_informel.name,
            description: grp_informel.description,
            objectclass: ['top', 'groupOfNames', 'Group Informel'],
          },
        };
      });
      for (const grp_informel of ldapGrpInformels.values()) res.send(grp_informel);
      res.end();
    }
  } catch (error) {
    console.error('Error handling search request:', error);
    res.end(new ldap.OtherError(error.message));
    return next(error);
  }
});

// Search groups
server.search(`ou=groups,${rootDn}`, async (req, res, next) => {
  console.log(`ou=groups,${rootDn} ` + req.scope);
  try {
    if (req.filter instanceof ldap.PresenceFilter && req.scope === 'base') {
      res.send({
        dn: `ou=groups,${rootDn}`,
        attributes: {
          objectclass: ['top', 'groupOfNames'],
          ou: 'groups',
        },
      });
      res.end();
    } else {
      res.send({
        dn: `ou=clubs,ou=groups,${rootDn}`,
        attributes: {
          objectclass: ['top', 'organizationalUnit'],
          ou: 'clubs',
        },
      });
      res.send({
        dn: `ou=ecoles,ou=groups,${rootDn}`,
        attributes: {
          objectclass: ['top', 'organizationalUnit'],
          ou: 'ecoles',
        },
      });
      res.send({
        dn: `ou=aes,ou=groups,${rootDn}`,
        attributes: {
          objectclass: ['top', 'organizationalUnit'],
          ou: 'aes',
        },
      });
      res.send({
        dn: `ou=grp-informels,ou=groups,${rootDn}`,
        attributes: {
          objectclass: ['top', 'organizationalUnit'],
          ou: 'grp-informels',
        },
      });
      res.end();
    }
  } catch (error) {
    console.error('Error handling search request:', error);
    res.end(new ldap.OtherError(error.message));
    return next(error);
  }
});

// Search rootDn
server.search(rootDn, async (req, res, next) => {
  console.log(rootDn + ' ' + req.scope);
  try {
    if (
      req.filter instanceof ldap.PresenceFilter &&
      req.filter.attribute === 'objectclass' &&
      req.scope === 'base'
    ) {
      console.log('search request for rootDn');
      res.send({
        dn: rootDn,
        attributes: {
          objectclass: ['top', 'dcObject', 'organization'],
          o: 'inp-net',
          dc: 'etu-inpt',
        },
      });
      res.end();
      return next();
    } else {
      res.send({
        dn: `ou=people,${rootDn}`,
        attributes: {
          objectclass: ['top', 'organizationalUnit'],
          ou: 'people',
        },
      });
      res.send({
        dn: `ou=groups,${rootDn}`,
        attributes: {
          objectclass: ['top', 'organizationalUnit'],
          ou: 'groups',
        },
      });
      res.end();
      return next();
    }
  } catch (error) {
    console.error('Error handling search request:', error);
    res.end(new ldap.OtherError(error.message));
    return next(error);
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
