function getUserPushToken(userId) {
  const envKey = `PUSH_TOKEN_${userId}`;
  return process.env[envKey] || null;
}

async function sendPush(userId, title, body, options = {}) {
  const pushToken = options.pushToken || getUserPushToken(userId);
  if (!pushToken) {
    return { ok: false, reason: 'push token missing', userId };
  }

  const message = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data: { userId, ...options.data },
  };

  return { ok: true, message };
}

module.exports = { getUserPushToken, sendPush };
