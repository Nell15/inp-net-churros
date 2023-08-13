/* eslint-disable */

function parseDNToList(dn) {
  const parts = dn.toString().split(',').reverse();
  const list = [];

  for (const part of parts) {
    const [key, value] = part.split('=');
    const keyTrimmed = key.trim();
    const valueTrimmed = value.trim();

    list.push({ key: keyTrimmed, value: valueTrimmed });
  }

  return list;
}

function findByKey(list, key) {
  const matchingItems = [];

  for (const item of list) {
    if (item.key === key) {
      matchingItems.push(item.value);
    }
  }

  return matchingItems.length > 0 ? matchingItems : null;
}


function printList(list) {
  for (const item of list) {
    console.log(`${item.key}=${item.value}`);
  }
}

// Return the scope of the DN
function scope(list) {
  const scope = {
    school: findByKey(list, 'o') ? findByKey(list, 'o')[0] : null,
    kind: findByKey(list, 'ou') ? findByKey(list, 'ou')[0] : null,
    section: findByKey(list, 'ou') ? findByKey(list, 'ou')[1] : null,
    person: findByKey(list, 'uid') ? findByKey(list, 'uid')[0] : null,
    group: findByKey(list, 'cn') ? findByKey(list, 'cn')[0] : null,
  }
  if (scope.person) {
    return { ...scope, type: 'person' }
  } else if (scope.group) {
    return { ...scope, type: 'group' }
  } else if (scope.section) {
    return { ...scope, type: 'section' }
  } else if (scope.kind) {
    return { ...scope, type: 'kind' }
  } else if (scope.school) {
    return { ...scope, type: 'school' }
  }
  return { ...scope, type: 'rootDN' }
};

export { parseDNToList, findByKey, scope, printList };
