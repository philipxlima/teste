const mongoose = require("mongoose");

const { Schema } = mongoose;

const playlistSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        default: "Minhas Músicas Favoritas" // Default playlist name
    },
    songs: [
        {
            type: String, // Assuming song IDs are strings
            ref: "Song" // Optional: if you have a Song model
        }
    ]
}, { _id: true }); // Ensure playlists have their own IDs

const userSchema = new Schema(
  {
    email: {
      required: true,
      type: String,
      unique: true, 
      trim: true, 
      lowercase: true 
    },
    password: {
      required: true,
      type: String,
    },
    name: {
      required: true,
      type: String,
      trim: true
    },
    profilePicture: {
      type: mongoose.Schema.Types.ObjectId, // Changed to ObjectId
      ref: 'uploads.files', // Reference to the GridFS files collection (optional but good practice)
      default: null 
    },
    library: [ // This can be kept for general liked songs, or refactored into the new playlist system
      {
        type: String,
        ref: "Song",
      },
    ],
    playlists: [playlistSchema] // Array of playlists
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
