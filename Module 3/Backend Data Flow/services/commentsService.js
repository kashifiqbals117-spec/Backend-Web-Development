const postsRepo = require('./../repository/postsRepo');
const commentsRepo = require('./../repository/commentsRepo');
const AppError = require('./../utils/AppError');

/**
 * TODO (Multi-step workflow): add a comment to a post.
 * Model this as an ordered sequence of service methods, ALL CHECKS BEFORE ANY WRITE:
 *   1. The post must exist            -> AppError('Post not found', 404)
 *   2. The post must not be locked    -> AppError('Post is locked for new comments', 409)
 *   3. THEN insert the comment        -> commentsRepo.insert({ postId, authorId: userId, body })
 *   4. THEN bump the post's count     -> postsRepo.incrementCommentCount(postId)
 *   5. return the created comment
 * No write may happen before both checks pass.
 */
exports.addComment = async (postId, userId, body) => {
  const post = await postsRepo.findById(postId);

  // 1. Post must exist
  if (!post) {
    throw new AppError('Post not found', 404);
  }

  // 2. Post must not be locked
  if (post.locked) {
    throw new AppError('Post is locked for new comments', 409);
  }
  
  // 3. Insert the comment
  const comment = await commentsRepo.insert({ postId, authorId: userId, body });

  // 4. Bump the post's comment count
  await postsRepo.incrementCommentCount(postId);

  // 5. Return the created comment
  return comment;
};
