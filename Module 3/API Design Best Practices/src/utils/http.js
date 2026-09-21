function sendList(res, rows, meta) {
  const body = { data: rows };
  if (meta !== undefined) {
    body.meta = meta;
  }
  return res.status(200).json(body);
}

function sendCreated(res, post) {
  return res.status(201).json({ data: post });
}

function sendOk(res, payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return res.status(200).json(payload);
  }
  return res.status(200).json({ data: payload });
}

function sendError(res, status, payload) {
  let message = 'An error occurred';
  if (typeof payload === 'string') {
    message = payload;
  } else if (payload && typeof payload === 'object') {
    message = payload.message || (typeof payload.error === 'string' ? payload.error : payload.error?.message) || message;
  }

  // Safe internal failure: prevent leaking stack traces, fake DB queries, or internal details
  if (status >= 500) {
    message = 'Internal server error';
  }

  return res.status(status).json({
    error: {
      message
    }
  });
}

module.exports = {
  sendList,
  sendCreated,
  sendOk,
  sendError
};
