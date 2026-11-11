const documents = new Map();

function save(document) {
  documents.set(document.id, { ...document });
}

function findById(id) {
  const document = documents.get(id);
  return document ? { ...document } : null;
}

function findByOwner(owner) {
  return [...documents.values()]
    .filter((document) => document.owner === owner)
    .map((document) => ({ ...document }));
}

function getUsage() {
  return [...documents.values()].reduce((usage, document) => ({
    count: usage.count + 1,
    bytes: usage.bytes + document.size,
  }), { count: 0, bytes: 0 });
}

module.exports = { save, findById, findByOwner, getUsage };