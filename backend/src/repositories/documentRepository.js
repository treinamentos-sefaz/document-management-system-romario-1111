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

module.exports = { save, findById, findByOwner };