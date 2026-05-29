const userPublicSelect = {
  id: true,
  username: true,
  number: true,
  icName: true,
  avatar: true,
  role: true,
  createdAt: true,
};

function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    number: user.number,
    icName: user.icName,
    avatar: user.avatar,
    displayName: user.icName || user.username,
    role: user.role,
    createdAt: user.createdAt,
  };
}

module.exports = { userPublicSelect, toPublicUser };
