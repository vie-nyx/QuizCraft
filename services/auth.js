const JWT = require("jsonwebtoken");

const secret = "$uperMan@123";

function createTokenForUser(user) {
  const payload = {
    id: user.RollNumber,
    name: user.Name,
    email: user.Email,
  };
  const token = JWT.sign(payload, secret);
  return token;
}

function validateToken(token) {
  const payload = JWT.verify(token, secret);
  return payload;
}

module.exports = {
  createTokenForUser,
  validateToken,
};
