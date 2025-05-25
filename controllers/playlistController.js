const User = require("../models/user");
const mongoose = require("mongoose");

// Criar uma nova playlist para o usuário logado
exports.createPlaylist = async (req, res, next) => {
    const { name } = req.body;
    const userId = req.userId; // Assumindo que o ID do usuário vem do middleware isAuth

    try {
        const user = await User.findById(userId);
        if (!user) {
            const error = new Error("Usuário não encontrado.");
            error.statusCode = 404;
            throw error;
        }

        const newPlaylist = {
            name: name || "Nova Playlist", // Nome padrão se não fornecido
            songs: []
        };

        user.playlists.push(newPlaylist);
        await user.save();

        // Retorna a playlist recém-criada (a última do array)
        const createdPlaylist = user.playlists[user.playlists.length - 1];

        res.status(201).json({
            message: "Playlist criada com sucesso!",
            playlist: createdPlaylist
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Obter todas as playlists do usuário logado
exports.getPlaylists = async (req, res, next) => {
    const userId = req.userId;

    try {
        const user = await User.findById(userId).select("playlists"); // Seleciona apenas o campo playlists
        if (!user) {
            const error = new Error("Usuário não encontrado.");
            error.statusCode = 404;
            throw error;
        }

        res.status(200).json({
            message: "Playlists recuperadas com sucesso!",
            playlists: user.playlists
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Adicionar uma música a uma playlist específica
exports.addSongToPlaylist = async (req, res, next) => {
    const { playlistId, songId } = req.body;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        const error = new Error("ID da playlist inválido.");
        error.statusCode = 400;
        return next(error);
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            const error = new Error("Usuário não encontrado.");
            error.statusCode = 404;
            throw error;
        }

        const playlist = user.playlists.id(playlistId);
        if (!playlist) {
            const error = new Error("Playlist não encontrada.");
            error.statusCode = 404;
            throw error;
        }

        // Verificar se a música já existe na playlist para evitar duplicatas
        if (playlist.songs.includes(songId)) {
            return res.status(409).json({ message: "Música já existe nesta playlist." });
        }

        playlist.songs.push(songId);
        await user.save();

        res.status(200).json({
            message: "Música adicionada à playlist com sucesso!",
            playlist: playlist
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Remover uma música de uma playlist específica
exports.removeSongFromPlaylist = async (req, res, next) => {
    const { playlistId, songId } = req.body; // Ou req.params se preferir na URL
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        const error = new Error("ID da playlist inválido.");
        error.statusCode = 400;
        return next(error);
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            const error = new Error("Usuário não encontrado.");
            error.statusCode = 404;
            throw error;
        }

        const playlist = user.playlists.id(playlistId);
        if (!playlist) {
            const error = new Error("Playlist não encontrada.");
            error.statusCode = 404;
            throw error;
        }

        playlist.songs.pull(songId); // Remove a música do array
        await user.save();

        res.status(200).json({
            message: "Música removida da playlist com sucesso!",
            playlist: playlist
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Renomear uma playlist
exports.renamePlaylist = async (req, res, next) => {
    const { playlistId, newName } = req.body;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        const error = new Error("ID da playlist inválido.");
        error.statusCode = 400;
        return next(error);
    }
    if (!newName || newName.trim() === "") {
        const error = new Error("O novo nome da playlist não pode ser vazio.");
        error.statusCode = 422;
        return next(error);
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            const error = new Error("Usuário não encontrado.");
            error.statusCode = 404;
            throw error;
        }

        const playlist = user.playlists.id(playlistId);
        if (!playlist) {
            const error = new Error("Playlist não encontrada.");
            error.statusCode = 404;
            throw error;
        }

        playlist.name = newName;
        await user.save();

        res.status(200).json({
            message: "Playlist renomeada com sucesso!",
            playlist: playlist
        });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};

// Deletar uma playlist
exports.deletePlaylist = async (req, res, next) => {
    const { playlistId } = req.body; // Ou req.params.playlistId
    const userId = req.userId;

     if (!mongoose.Types.ObjectId.isValid(playlistId)) {
        const error = new Error("ID da playlist inválido.");
        error.statusCode = 400;
        return next(error);
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            const error = new Error("Usuário não encontrado.");
            error.statusCode = 404;
            throw error;
        }
        
        const playlist = user.playlists.id(playlistId);
        if (!playlist) {
            const error = new Error("Playlist não encontrada para este usuário.");
            error.statusCode = 404;
            throw error;
        }

        // user.playlists.pull(playlistId); // Correção: usar o método pull do Mongoose subdocument array
        // A forma correta de remover um subdocumento é usando o método `remove()` no próprio subdocumento
        // ou filtrando o array e reatribuindo, mas `pull` é mais direto se o objeto já foi encontrado.
        // No entanto, para subdocumentos em arrays, o Mongoose oferece um método `remove` no próprio subdocumento.
        // Se `playlist` é o subdocumento, `playlist.remove()` deveria funcionar, mas precisa ser feito no contexto do array pai.
        // A maneira mais segura é filtrar o array ou usar `pull` com o ID.

        user.playlists = user.playlists.filter(p => p._id.toString() !== playlistId);
        
        await user.save();

        res.status(200).json({ message: "Playlist deletada com sucesso!" });

    } catch (error) {
        if (!error.statusCode) {
            error.statusCode = 500;
        }
        next(error);
    }
};
