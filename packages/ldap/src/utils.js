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
  for (const item of list) {
    if (item.key === key) {
      return item.value;
    }
  }
  return null;
}

function printList(list) {
  for (const item of list) {
    console.log(`${item.key}=${item.value}`);
  }
}

export { parseDNToList, findByKey, printList };
