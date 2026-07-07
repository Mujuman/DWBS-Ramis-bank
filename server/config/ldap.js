const ldap = require('ldapjs');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

/**
 * Creates a bound LDAP client for Active Directory authentication.
 * Uses LDAPS (TLS) on port 636 for secure transport.
 */
const createLdapClient = () => {
  const tlsOptions = {};

  // Load custom CA cert if provided (for self-signed AD certs)
  const caCertPath = process.env.AD_TLS_CA_CERT_PATH;
  if (caCertPath && fs.existsSync(path.resolve(caCertPath))) {
    tlsOptions.ca = [fs.readFileSync(path.resolve(caCertPath))];
  }

  const client = ldap.createClient({
    url: process.env.AD_URL || 'ldaps://ad.rammisbank.et:636',
    tlsOptions,
    reconnect: true,
    timeout: 10000,
    connectTimeout: 10000,
  });

  client.on('error', (err) => {
    console.error('[LDAP] Client error:', err.message);
  });

  return client;
};

/**
 * Authenticates a user against Active Directory via LDAP bind.
 * Returns user attributes if successful, throws on failure.
 */
const authenticateUser = (username, password) => {
  return new Promise((resolve, reject) => {
    if (!username || !password) {
      return reject(new Error('Username and password are required'));
    }

    // Sanitize username — only allow alphanumeric, dots, underscores, hyphens
    const safeUsername = username.replace(/[^a-zA-Z0-9._-]/g, '');
    if (safeUsername !== username) {
      return reject(new Error('Invalid characters in username'));
    }

    const client = createLdapClient();
    const userDN = `${safeUsername}@${process.env.AD_BASE_DN?.replace(/DC=/g, '').replace(/,/g, '.') || 'rammisbank.et'}`;

    client.bind(userDN, password, (bindErr) => {
      if (bindErr) {
        client.destroy();
        return reject(new Error('Invalid credentials'));
      }

      // After bind, search for user attributes
      const searchOptions = {
        filter: `(sAMAccountName=${safeUsername})`,
        scope: 'sub',
        attributes: ['sAMAccountName', 'displayName', 'mail', 'memberOf', 'userAccountControl'],
      };

      client.search(
        process.env.AD_USER_SEARCH_BASE || `DC=rammisbank,DC=et`,
        searchOptions,
        (searchErr, res) => {
          if (searchErr) {
            client.destroy();
            return reject(new Error('LDAP search failed'));
          }

          const entries = [];

          res.on('searchEntry', (entry) => {
            entries.push({
              sAMAccountName: entry.object.sAMAccountName,
              displayName: entry.object.displayName,
              mail: entry.object.mail,
              memberOf: entry.object.memberOf,
              userAccountControl: entry.object.userAccountControl,
            });
          });

          res.on('error', (err) => {
            client.destroy();
            reject(new Error('LDAP search error: ' + err.message));
          });

          res.on('end', () => {
            client.destroy();
            if (entries.length === 0) {
              return reject(new Error('User not found in directory'));
            }
            resolve(entries[0]);
          });
        }
      );
    });
  });
};

module.exports = { authenticateUser, createLdapClient };
