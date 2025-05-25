const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const multer = require("multer");
const mongoose = require("mongoose"); // Necessário para GridFS
const { GridFsStorage } = require("multer-gridfs-storage"); // Importar GridFsStorage
const crypto = require("crypto"); // Para gerar nomes de arquivo únicos
const path = require("path");

const User = require("../models/user");
const { getDecodedJWT } = require("../lib/is-auth");

// Configuração do GridFS Storage Engine
const storage = new GridFsStorage({
    url: process.env.MONGODB_SERVER,
    options: { useNewUrlParser: true, useUnifiedTopology: true },
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename = buf.toString("hex") + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    bucketName: "profile_pictures" // Nome da coleção no MongoDB para GridFS
                };
                resolve(fileInfo);
            });
        });
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === "image/jpeg" || file.mimetype === "image/png" || file.mimetype === "image/jpg") {
        cb(null, true);
    } else {
        cb(new Error("Formato de arquivo não suportado. Apenas JPEG, PNG e JPG são permitidos."), false);
    }
};

const upload = multer({ storage: storage, fileFilter: fileFilter, limits: { fileSize: 1024 * 1024 * 5 } }); // Limite de 5MB

// Função auxiliar para deletar arquivos do GridFS
const deleteGridFSFile = async (fileId) => {
    if (!fileId) return;
    try {
        const gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: "profile_pictures"
        });
        await gfs.delete(new mongoose.Types.ObjectId(fileId));
        console.log(`Arquivo ${fileId} deletado do GridFS.`);
    } catch (error) {
        console.error(`Erro ao deletar arquivo ${fileId} do GridFS:`, error);
        // Não lançar erro aqui para não interromper o fluxo principal, mas logar
    }
};

exports.signup = async (req, res, next) => {
  const errors = validationResult(req);
  try {
    if (!errors.isEmpty()) {
      const msg = errors.array()?.[0]?.msg;
      const error = new Error(msg || "Validation failed! please enter valid input.");
      error.statusCode = 422;
      if (req.file) {
        await deleteGridFSFile(req.file.id); // Deletar do GridFS se o signup falhar
      }
      throw error;
    }

    const { email, password, name, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        const error = new Error("As senhas não coincidem.");
        error.statusCode = 422;
        if (req.file) {
            await deleteGridFSFile(req.file.id);
        }
        throw error;
    }

    const salt = await bcrypt.genSalt(10);
    const hashPwd = await bcrypt.hash(password, salt);

    let profilePictureId = null;
    if (req.file) {
        profilePictureId = req.file.id; // Salva o ID do arquivo do GridFS
    }

    const user = new User({
      name,
      email,
      password: hashPwd,
      profilePicture: profilePictureId // Armazena o ObjectId do GridFS
    });

    const newUser = await user.save();

    return res.status(201).json({
      message: "Conta criada com sucesso.",
      user: {
        name: newUser.name,
        email: newUser.email,
        profilePicture: newUser.profilePicture // Retorna o ID da imagem
      },
    });
  } catch (error) {
    if (req.file && error.statusCode !== 422) {
        await deleteGridFSFile(req.file.id);
    }
    if (!error.statusCode) {
        error.statusCode = 500;
    }
    next(error);
  }
};

exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      const error = new Error("Usuário não encontrado.");
      error.statusCode = 401;
      throw error;
    }
    const isAuthenticated = await bcrypt.compare(password, user.password);
    if (!isAuthenticated) {
      const error = new Error("Email ou Senha incorretos.");
      error.statusCode = 401;
      throw error;
    }
    const token = jwt.sign(
      { email: user.email, userId: user._id.toString() },
      process.env.SECRET_KEY_JWT,
      { expiresIn: "1h" }
    );
    return res.status(200).json({
      token,
      userId: user._id.toString(),
      username: user.name,
      profilePicture: user.profilePicture // Retorna o ID da imagem
    });
  } catch (error) {
    if (!error.statusCode) {
        error.statusCode = 500;
    }
    next(error);
  }
};

exports.isAuth = async (req, res, next) => {
  try {
    const authorization = req.get("Authorization");
    if (!authorization) {
      const error = new Error("Não autorizado");
      error.statusCode = 401;
      throw error;
    }
    const token = authorization?.split(" ")?.[1];
    if (!token) {
      const error = new Error("Não autorizado");
      error.statusCode = 401;
      throw error;
    }
    const decodedToken = getDecodedJWT(token);
    const user = await User.findById(decodedToken.userId);
    if (!user) {
      const error = new Error("Não autorizado");
      error.statusCode = 401;
      throw error;
    }
    return res.status(200).json({
      decodedToken,
      username: user.name,
      profilePicture: user.profilePicture // Retorna o ID da imagem
    });
  } catch (error) {
    if (!error.statusCode) {
        error.statusCode = 500;
    }
    next(error);
  }
};

exports.updateProfilePicture = async (req, res, next) => {
    try {
        if (!req.file) {
            const error = new Error("Nenhuma imagem selecionada.");
            error.statusCode = 422;
            throw error;
        }

        const userId = req.userId;
        const user = await User.findById(userId);

        if (!user) {
            const error = new Error("Usuário não encontrado.");
            error.statusCode = 404;
            await deleteGridFSFile(req.file.id); // Deleta o novo arquivo se o usuário não for encontrado
            throw error;
        }

        // Se o usuário já tiver uma foto de perfil, remove a antiga do GridFS
        if (user.profilePicture) {
            await deleteGridFSFile(user.profilePicture);
        }

        user.profilePicture = req.file.id; // Salva o ID do novo arquivo do GridFS
        await user.save();

        res.status(200).json({ 
            message: "Foto de perfil atualizada com sucesso!", 
            profilePicture: user.profilePicture // Retorna o ID da nova imagem
        });

    } catch (error) {
        if (req.file && error.statusCode !== 422 && error.statusCode !== 404) { 
            await deleteGridFSFile(req.file.id);
        }
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Middleware de upload para ser usado nas rotas
exports.uploadMiddleware = upload.single("profilePicture");

// Nova rota para servir imagens do GridFS
exports.getProfilePicture = async (req, res, next) => {
    try {
        const fileId = req.params.fileId;
        if (!mongoose.Types.ObjectId.isValid(fileId)) {
            return res.status(400).json({ message: "ID de arquivo inválido." });
        }

        const gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: "profile_pictures"
        });

        const downloadStream = gfs.openDownloadStream(new mongoose.Types.ObjectId(fileId));

        downloadStream.on("file", (file) => {
            res.set("Content-Type", file.contentType);
            res.set("Content-Disposition", 'inline; filename="' + file.filename + '"');
        });

        downloadStream.on("data", (chunk) => {
            res.write(chunk);
        });

        downloadStream.on("error", (err) => {
            if (err.message.includes("File not found")) {
                return res.status(404).json({ message: "Imagem não encontrada." });
            }
            console.error("Erro ao buscar imagem do GridFS:", err);
            res.status(500).json({ message: "Erro ao buscar imagem." });
        });

        downloadStream.on("end", () => {
            res.end();
        });

    } catch (error) {
        console.error("Erro na rota getProfilePicture:", error);
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};
