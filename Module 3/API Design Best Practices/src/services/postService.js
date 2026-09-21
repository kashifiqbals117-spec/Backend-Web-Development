const store = require('../data/postStore');

const DEFAULT_LIMIT = 2;
const MAX_LIMIT = 10;

function listPosts(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const rawLimit = parseInt(query.limit, 10);
  const parsedLimit = isNaN(rawLimit) || rawLimit < 1 ? DEFAULT_LIMIT : rawLimit;
  const limit = Math.min(parsedLimit, MAX_LIMIT);

  const allPosts = store.getAllPosts();
  const total = allPosts.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const rows = allPosts.slice(startIndex, startIndex + limit);

  return {
    rows,
    meta: {
      page,
      limit,
      total,
      totalPages
    }
  };
}

function getPost(id) {
  return store.getPostById(id);
}

function createPost(body = {}) {
  return store.createPost({
    title: body.title,
    author: body.author
  });
}

function likePost(id) {
  return store.incrementLikes(id);
}

function explode() {
  const err = new Error('SQLITE_CONSTRAINT in posts table');
  err.statusCode = 500;
  throw err;
}

module.exports = {
  listPosts,
  getPost,
  createPost,
  likePost,
  explode
};
