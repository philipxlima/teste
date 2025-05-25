const express = require("express");
const router = express.Router();
const playlistController = require("../controllers/playlistController");
const { isAuth } = require("../lib/is-auth"); // Middleware de autenticação
const { body } = require("express-validator");

// Criar uma nova playlist
router.post("/", isAuth, [
    body("name").optional().trim().notEmpty().withMessage("O nome da playlist não pode ser apenas espaços em branco.")
], playlistController.createPlaylist);

// Obter todas as playlists do usuário
router.get("/", isAuth, playlistController.getPlaylists);

// Adicionar música a uma playlist
router.post("/songs", isAuth, [
    body("playlistId").notEmpty().withMessage("O ID da playlist é obrigatório.").isMongoId().withMessage("ID da playlist inválido."),
    body("songId").notEmpty().withMessage("O ID da música é obrigatório.")
], playlistController.addSongToPlaylist);

// Remover música de uma playlist
router.delete("/songs", isAuth, [
    body("playlistId").notEmpty().withMessage("O ID da playlist é obrigatório.").isMongoId().withMessage("ID da playlist inválido."),
    body("songId").notEmpty().withMessage("O ID da música é obrigatório.")
], playlistController.removeSongFromPlaylist);

// Renomear uma playlist
router.put("/:playlistId/rename", isAuth, [
    body("newName").trim().notEmpty().withMessage("O novo nome da playlist é obrigatório.")
], playlistController.renamePlaylist);

// Deletar uma playlist
router.delete("/:playlistId", isAuth, playlistController.deletePlaylist);

module.exports = router;
