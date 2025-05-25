const PORT = process.env.PORT || 8080;
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path"); // Adicionar path para servir arquivos estáticos

const app = express();

// const { client } = require("./lib/redis");
const deleteCacheCron = require("./lib/services");
const apiRoutes = require("./routes/api");
const authRoutes = require("./routes/auth");
const songRoutes = require("./routes/song");
const playlistRoutes = require("./routes/playlist"); // Adicionar rotas de playlist

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://soundrex.netlify.app",
      "https://master--soundrex.netlify.app",
      process.env.FRONTEND_URL || "http://localhost:3000" // Adicionar URL do frontend do .env
    ],
    credentials: true,
  }),
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir arquivos estáticos da pasta de uploads (para fotos de perfil)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/v1", apiRoutes);
app.use("/auth", authRoutes);
app.use("/soundrex", songRoutes); // Considerar renomear esta rota base se o nome do site mudar
app.use("/api/v1/playlists", playlistRoutes); // Registrar rotas de playlist

app.use((error, req, res, next) => {
  const message = error.message && error.message.toLowerCase().includes("mongodb")
    ? "Opps! Algo deu errado com o banco de dados. "
    : error.message || "Algo deu errado.";
  const status = error.statusCode || 500;
  console.error("ERROR:", error); // Logar o erro completo para debugging
  return res.status(status).json({ message, status, errors: error.errors }); // Incluir erros de validação se houver
});

deleteCacheCron();

mongoose
  .connect(process.env.MONGODB_SERVER)
  .then(() => {
    app.listen(PORT, () => {
      console.log("Servidor iniciado na porta: " + PORT);
      // client.flushall();
    });
  })
  .catch((err) => console.log("Erro ao conectar ao MongoDB:", err));
