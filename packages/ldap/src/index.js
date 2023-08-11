/* eslint-disable */
import ldap from 'ldapjs';
import { PrismaClient } from '../../../node_modules/@prisma/client';
import argon2 from 'argon2';
import dotenv from 'dotenv';
import { parseStringToTree, printTree } from './utils';

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

server.bind(`${rootDn}`, async (req, res, next) => {
  const bindDN = parseStringToTree(req.dn);
  const bindPassword = req.credentials;

  // Anonymous bind
  if (!bindDN || bindPassword === "") {
    res.end();
    return next();
  }

  try {
    // Look up user by bind DN (e.g., "uid=user123,ou=users,o=school,dc=mydomain,dc=com")
    const ldapUser = await prisma.userLdap.findUnique({
      where: { 
        uid: bindDN.findNodeByKey('uid').value,
      },
      include: { 
        user: {
          include: {
            credentials: true,
            major: {
              include: {
                schools: {
                  include: {
                    schoolLdap: true
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
    if (!ldapUser.user.major.schools.find((school) => school.schoolLdap.o == bindDN.findNodeByKey('o').value)) {
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
  const scope = parseStringToTree(req.dn.toString());
  console.log("DN: "+req.dn.toString())
  console.log("Filter: "+req.filter.toString())
  console.log("Attributes: "+req.attributes.toString())

  try {
    if (
      req.filter instanceof ldap.PresenceFilter &&
      req.filter.attribute === 'objectclass' &&
      req.scope === 0
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
      res.end();
      return next();
    } else {
      const schoolsLdap = await prisma.schoolLdap.findMany({include: {school: true, ObjectClass: true}});
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
prisma