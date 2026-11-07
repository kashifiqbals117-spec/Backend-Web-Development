const prisma = require('../db/prisma');

async function findAll() {
  return prisma.post.findMany({
    orderBy: { id: 'asc' },
  });
}

async function findById(id) {
  return prisma.post.findUnique({
    where: { id: Number(id) },
  });
}

async function create(fields) {
  return prisma.post.create({
    data: {
      title: fields.title,
      body: fields.body || '',
      authorId: Number(fields.authorId),
    },
  });
}

async function update(id, patch) {
  try {
    const data = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.body !== undefined) data.body = patch.body;
    if (patch.authorId !== undefined) data.authorId = Number(patch.authorId);

    return await prisma.post.update({
      where: { id: Number(id) },
      data,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return null;
    }
    throw error;
  }
}

async function remove(id) {
  try {
    await prisma.post.delete({
      where: { id: Number(id) },
    });
    return true;
  } catch (error) {
    if (error.code === 'P2025') {
      return false;
    }
    throw error;
  }
}

module.exports = { findAll, findById, create, update, remove };
