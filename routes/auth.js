const express = require("express");
const { body } = require("express-validator");

const router = express.Router();

const User = require("../models/user");
const AuthController = require("../controllers/auth");
const isAuth = require("../lib/is-auth").isAuth;

// Rota de Signup com upload de foto de perfil
router.put(
  "/signup",
  AuthController.uploadMiddleware, // Middleware do Multer para o campo 'profilePicture'
  [
    body("email")
      .trim()
      .isEmail()
      .withMessage("Por favor, insira um email válido.")
      .custom((value, { req }) => {
        return User.findOne({ email: value })
          .then((userDoc) => {
            if (userDoc) {
              return Promise.reject("Este email já está em uso.");
            }
          })
      })
      .normalizeEmail(),
    body("password")
      .trim()
      .isLength({ min: 6 })
      .withMessage("A senha deve ter pelo menos 6 caracteres."),
    body("confirmPassword")
      .trim()
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error("As senhas não coincidem.");
        }
        return true;
      }),
    body("name").trim().not().isEmpty().withMessage("O nome é obrigatório."),
  ],
  AuthController.signup
);

// Rota de Login
router.post("/login", AuthController.login);

// Rota para verificar autenticação (is-auth)
router.post("/is-auth", AuthController.isAuth); 

// Rota para atualizar foto de perfil (requer autenticação)
router.post(
    "/update-profile-picture", 
    isAuth, 
    AuthController.uploadMiddleware, 
    AuthController.updateProfilePicture
);

// Nova rota para servir imagens de perfil do GridFS
router.get("/profile-picture/:fileId", AuthController.getProfilePicture);

module.exports = router;
