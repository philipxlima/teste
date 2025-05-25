const jwt = require("jsonwebtoken");

exports.getDecodedJWT = (jsonwebtoken) => {
  let decodedToken;
  try {
    decodedToken = jwt.verify(jsonwebtoken, process.env.SECRET_KEY_JWT);
  } catch (error) {
    throw error;
  }
  return decodedToken;
};

exports.isAuth = (req, res, next) => {
  const authHeader = req.get("Authorization");
  if (!authHeader) {
    const error = new Error("Não autenticado.");
    error.statusCode = 401;
    throw error;
  }
  const token = authHeader.split(" ")[1];
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, process.env.SECRET_KEY_JWT);
  } catch (err) {
    err.statusCode = 500;
    throw err;
  }
  if (!decodedToken) {
    const error = new Error("Não autenticado.");
    error.statusCode = 401;
    throw error;
  }
  req.userId = decodedToken.userId;
  next();
};

