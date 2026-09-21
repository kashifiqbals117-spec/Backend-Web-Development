const service = require('../services/postService');
const http = require('../utils/http');

function listPosts(req, res) {
  const { rows, meta } = service.listPosts(req.query);
  return http.sendList(res, rows, meta);
}

function getPost(req, res) {
  const post = service.getPost(req.params.id);
  if (!post) {
    return http.sendError(res, 404, { message: 'Post not found' });
  }
  return http.sendOk(res, post);
}

function createPost(req, res) {
  const { title, author } = req.body || {};
  if (!title || !author) {
    return http.sendError(res, 400, { message: 'Title and author are required' });
  }
  const post = service.createPost(req.body);
  return http.sendCreated(res, post);
}

function likePost(req, res) {
  const post = service.likePost(req.params.id);
  if (!post) {
    return http.sendError(res, 404, { message: 'Post not found' });
  }
  return http.sendOk(res, post);
}

function explode(req, res) {
  try {
    service.explode();
  } catch (err) {
    return http.sendError(res, 500, { message: 'Internal server error' });
  }
}

module.exports = {
  listPosts,
  getPost,
  createPost,
  likePost,
  explode
};
